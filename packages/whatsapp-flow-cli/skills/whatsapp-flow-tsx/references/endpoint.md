# Data-exchange endpoint reference

Server-side companion to a TSX flow that uses `<Exchange>`. The framework
authors the flow JSON; **you write the endpoint separately**. This document
is the wire protocol and the one-time provisioning steps.

For the TSX side — declaring `dataApiVersion`/`endpointUri`, the `Exchange`
component, the static-routing constraints, the `SUCCESS` / `error_message`
magic — see [authoring.md § Data-exchange flows](authoring.md#data-exchange-endpoint-flows).

## Contents

- [Provisioning (one-time, before first publish)](#provisioning-one-time-before-first-publish)
- [Wire protocol](#wire-protocol)
- [Action routing](#action-routing)
- [Reference implementation (Node.js)](#reference-implementation-nodejs)
- [Smoke-testing an endpoint](#smoke-testing-an-endpoint)
- [Common gotchas](#common-gotchas)

## Provisioning (one-time, before first publish)

Meta refuses to publish a data-exchange flow unless **both** are true:

1. The phone number has a signed encryption public key on file.
2. The flow has `endpoint_uri` set.

Do these in order. Skipping either fails publish with `139002`.

### 1. Generate an RSA-2048 keypair

```bash
openssl genrsa -aes256 -passout pass:"$PASSPHRASE" -out private.pem 2048
openssl rsa -in private.pem -passin pass:"$PASSPHRASE" -pubout -out public.pem
```

Store the private key + passphrase somewhere your endpoint can read at runtime.
**Don't commit them.** Most secret stores accept single-line values — for
multi-line PEMs that get corrupted in transit (e.g. `convex env set`, some CI
systems), base64-encode the PEM and decode at runtime.

### 2. Upload the public key to the phone number

The key is **per-phone-number**, not per-flow. One upload covers every flow on
that number.

```bash
curl -sS -X POST \
  "https://graph.facebook.com/v25.0/$PHONE_NUMBER_ID/whatsapp_business_encryption" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "business_public_key=$(cat public.pem)"
# → {"success":true}
```

Verify Meta signed it (signing is automatic on upload):

```bash
curl -sS "https://graph.facebook.com/v25.0/$PHONE_NUMBER_ID/whatsapp_business_encryption" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# → ... "business_public_key_signature_status": "VALID"
```

`MISMATCH` means the stored public key doesn't match what your endpoint actually
decrypts with — re-upload.

### 3. Set `endpoint_uri` on each data-exchange flow

```bash
curl -sS -X POST "https://graph.facebook.com/v25.0/$FLOW_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "endpoint_uri=https://your-app.example.com/whatsapp/flow"
# → {"success":true}
```

Per-flow, per-WABA. Set this on every flow ID in `flows.lock.json` that uses
`<Exchange>`. Dev and prod WABAs have different flow IDs — provision both.

## Wire protocol

### Request — encrypted POST from Meta

```json
{
  "encrypted_flow_data": "<base64>",
  "encrypted_aes_key":   "<base64>",
  "initial_vector":      "<base64>"
}
```

To decrypt:

1. RSA-OAEP unwrap `encrypted_aes_key` with your private key (SHA-256 hash, MGF1).
   Yields a **16-byte AES-128 key**.
2. The last **16 bytes** of `encrypted_flow_data` are the GCM auth tag; the
   rest is ciphertext.
3. AES-128-GCM decrypt with the unwrapped key and the request's `initial_vector`,
   setting the auth tag.

Plaintext is UTF-8 JSON:

```json
{
  "version": "3.0",
  "action": "ping" | "INIT" | "BACK" | "data_exchange",
  "screen": "<SCREEN_ID>",
  "data":   { ... },
  "flow_token": "<your token>"
}
```

`action` enum:

- `ping` — health check during publish and periodically afterwards.
- `INIT` — flow opened (sent only if you configured server-driven init).
- `BACK` — user tapped back.
- `data_exchange` — user tapped an `<Exchange>` action; `screen` is the source
  screen, `data` is the payload you declared on the `<Exchange>`.

### Response — encrypted plain-text body

Build the response JSON:

```json
{ "screen": "<NEXT_SCREEN_OR_SUCCESS>", "data": { ... } }
```

Or for `ping`:

```json
{ "data": { "status": "active" } }
```

Encrypt with the **same AES key** the request was decrypted with, but with the
**IV flipped**: every byte XOR'd with `0xff`. AES-128-GCM, append the 16-byte
auth tag to the ciphertext, base64-encode the whole thing, return as the
response body with `Content-Type: text/plain`.

### Special response values

- `screen: "SUCCESS"` — Meta's reserved terminal. Closes the flow with the
  built-in "Done" UI and sends `data.extension_message_response.params` back to
  the business as the `nfm_reply` webhook payload.
- `data.error_message: "<msg>"` — magic field, surfaces as an inline error on
  whichever screen you respond with. No schema declaration needed.

### Status codes

- `200` — encrypted response in body.
- `421` — decryption failed (or you can't load your private key). The client
  re-fetches the public key and retries once. Return this whenever decryption
  blows up rather than `500` — it gives Meta a recovery path.
- `427` — signature validation failed (relevant only if you opted into
  `flow_token_signature` JWTs).

## Action routing

```
incoming
  ├─ ping              → 200 + {"data":{"status":"active"}}
  ├─ INIT|BACK         → 200 + {"screen":"START","data":{}}        (or whatever initial state you want)
  ├─ data_exchange     → 200 + {"screen":"<next>","data":{...}}    (your business logic)
  └─ data.error        → 200 + {"data":{"acknowledged":true}}      (client-side error_notification)

decrypt failure        → 421 + empty body
```

The `data.error` branch catches `error_notification`, which the client sends
when *its* runtime hits a problem (your flow JSON references a bad expression,
a renderer crashes, etc.). Always acknowledge.

The `screen` value in every response must be a real **compiled screen id** —
the `Index` export compiles to id `START`, `Done` to `DONE`, `OrderConfirm`
to `ORDER_CONFIRM`, etc. (or one of Meta's reserved ids, currently just
`SUCCESS`). Sending a screen id that doesn't exist makes Meta drop the
response and show the user a generic "something went wrong" — and there is
**no log line on either end** to tell you that's why. Mirror the ids exactly
as `flows build` emits them; when in doubt, grep `.build/<flow>.json` for the
screen objects.

## Reference implementation (Node.js)

```ts
import {
  constants, createCipheriv, createDecipheriv, createPrivateKey, privateDecrypt,
} from "node:crypto";

function loadPrivateKey() {
  const pem = Buffer.from(process.env.FLOW_PRIVATE_KEY_B64!, "base64").toString("utf8");
  return createPrivateKey({ key: pem, passphrase: process.env.FLOW_PRIVATE_KEY_PASSPHRASE });
}

export async function handleFlow(rawBody: string) {
  const envelope = JSON.parse(rawBody);
  let payload, aesKey: Buffer, iv: Buffer;
  try {
    const key = loadPrivateKey();
    aesKey = privateDecrypt(
      { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(envelope.encrypted_aes_key, "base64"),
    );
    iv = Buffer.from(envelope.initial_vector, "base64");
    const ct = Buffer.from(envelope.encrypted_flow_data, "base64");
    const tag = ct.subarray(ct.length - 16);
    const body = ct.subarray(0, ct.length - 16);
    const dec = createDecipheriv("aes-128-gcm", aesKey, iv);
    dec.setAuthTag(tag);
    payload = JSON.parse(Buffer.concat([dec.update(body), dec.final()]).toString("utf8"));
  } catch {
    return { status: 421, body: "" };
  }

  const responseJson = await route(payload); // your business logic

  const flippedIv = Buffer.from(iv.map((b) => b ^ 0xff));
  const cipher = createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const pt = Buffer.from(JSON.stringify(responseJson), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  return {
    status: 200,
    body: Buffer.concat([ct, cipher.getAuthTag()]).toString("base64"),
  };
}
```

## Smoke-testing an endpoint

Encrypt a `ping` with your own public key and post it to the deployed
endpoint — if it doesn't round-trip locally, Meta won't publish:

```js
// ping-test.mjs — run with the public.pem in cwd
import {
  createPublicKey, publicEncrypt, createCipheriv, createDecipheriv,
  randomBytes, constants,
} from "node:crypto";
import { readFileSync } from "node:fs";

const ENDPOINT = process.argv[2]; // e.g. https://example.com/whatsapp/flow
const aesKey = randomBytes(16);
const iv = randomBytes(16);
const encAesKey = publicEncrypt(
  { key: createPublicKey(readFileSync("public.pem", "utf8")),
    padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
  aesKey,
);
const cipher = createCipheriv("aes-128-gcm", aesKey, iv);
const pt = Buffer.from(JSON.stringify({ version: "3.0", action: "ping" }));
const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
const body = JSON.stringify({
  encrypted_flow_data: Buffer.concat([ct, cipher.getAuthTag()]).toString("base64"),
  encrypted_aes_key: encAesKey.toString("base64"),
  initial_vector: iv.toString("base64"),
});

const res = await fetch(ENDPOINT, {
  method: "POST", headers: { "Content-Type": "application/json" }, body,
});
console.log("HTTP", res.status);
if (res.status === 200) {
  const bytes = Buffer.from(await res.text(), "base64");
  const dec = createDecipheriv("aes-128-gcm", aesKey, Buffer.from(iv.map((b) => b ^ 0xff)));
  dec.setAuthTag(bytes.subarray(bytes.length - 16));
  const plain = Buffer.concat([dec.update(bytes.subarray(0, bytes.length - 16)), dec.final()]);
  console.log(plain.toString("utf8")); // → {"data":{"status":"active"}}
}
```

Run before every `flows push` that touches a data-exchange flow.

## Common gotchas

- **Don't store the PEM verbatim in single-line secret stores.** Newlines get
  munged silently and the next decrypt blows up with no log line. Base64 the
  PEM and decode at runtime. (Some secret stores accept multi-line; some
  pretend to and don't.)
- **`flows push` publishes immediately.** A broken endpoint means a broken
  live flow. Verify the endpoint is responding to encrypted pings *before*
  pushing.
- **The keypair is per-phone-number, not per-WABA.** If a WABA has dev and
  prod phone numbers, each gets its own upload.
- **Meta's `health_status.entities[].errors` includes unrelated issues** (e.g.
  WABA payment errors). Look at `validation_errors` for *flow*-level problems.
- **Cold starts vs. Meta's timeout.** Meta has roughly a 10-second budget for
  the endpoint to respond. If your function cold-starts slowly *and* your
  business logic is slow, publish-time pings fail and surface as 4233014
  "Endpoint not available."
- **Wrong screen id in a response is silent.** If your endpoint returns
  `{"screen":"INDEX",…}` but the compiled flow's screen id is `START`, Meta
  shows the user "something went wrong" with **no error_message, no log line
  on either side, no validation hint**. Common when you write the endpoint
  before checking `.build/<flow>.json` — the framework converts the `Index`
  export to id `START`, not `INDEX`. Cross-check screen ids against the
  compiled JSON.
