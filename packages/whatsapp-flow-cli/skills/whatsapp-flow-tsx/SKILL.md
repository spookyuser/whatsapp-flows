---
name: whatsapp-flow-tsx
description: Author, compile, and push WhatsApp Flows written as TypeScript/TSX. Use whenever the user wants to write, build, edit, compile, validate, or deploy a WhatsApp/Meta Flow (multi-screen forms, text/number/date inputs, dropdown/radio/checkbox/chips pickers, navigation lists, image carousels, If/Switch conditionals, routing, data-exchange endpoints, embedded images) — even if they don't say "TSX". Also for fixing flow build/validation errors and for `flows push` (syncing flows to Meta as drafts, optionally publishing). Flows are .tsx files in a flows/ app directory with flows.config.ts. Prefer this over hand-writing raw Flow JSON. To author WhatsApp message templates (pre-approved messages with {{1}} variables, header/body/footer, buttons), use the companion whatsapp-template-tsx skill instead. For lower-level Graph API lifecycle on existing flows — list, preview, deprecate, delete, send to a user, migrate, status — use a Meta Graph API CRUD workflow; not for general WhatsApp messaging.
---

# WhatsApp Flow authoring (TSX → Meta Flow JSON)

Author WhatsApp Flows as typed `.tsx` files and compile them to Meta Flow JSON.
**This is a compile-time authoring layer, not a runtime.** The `.tsx` runs once, at
build time, to emit an ordinary Flow JSON document. There is no React, no DOM, no
hooks, no device-side state — WhatsApp renders the compiled JSON natively. The TSX
is just a typed, validated way to *write* that JSON.

The same `flows/` app also authors **WhatsApp message templates** (the pre-approved
text/media messages you *send* to start a conversation). Those are a separate asset
with their own authoring rules — see the companion **`whatsapp-template-tsx`** skill.

Upgrading an **older project** (a `flow.config.ts` + `screens/` folder per flow, a
single `waba`/`tokenEnv`, or a WABA-keyed `flows.lock.json`) to the single-file,
named-environment model below? Use the **`whatsapp-flows-migration`** skill.

This skill covers the whole flow loop: write `.tsx`, compile, and **push** to Meta
(`flows push`). Push always publishes — flows go live immediately. Lower-level Meta
lifecycle on existing assets — preview, deprecate, delete, send, migrate, status —
belongs to a Meta Graph API CRUD workflow that owns those Graph API operations and
the phone-number ids (see [Handoff](#handoff-lower-level-lifecycle)).

## Where things live

- **A flows app** is a `flows/` directory, organized Next.js-style. `flows.config.ts`
  is the project config; **each top-level `.tsx` file is one flow** (e.g.
  `flows/woolworths-login.tsx`) — or a **message template** if it exports `template`
  (that's the `whatsapp-template-tsx` skill's job). `flows.lock.json` (committed) maps
  each flow/template to its Meta id per WABA.
- **Images** live in the host app's `public/` directory and are embedded as base64 at
  compile time (see [Images](#images)).
- **The compiler** is the `whatsapp-flow` CLI, shipped by the `whatsapp-flow-cli`
  package (this framework). In a host app, add `whatsapp-flow-cli` as a dependency
  (published, or `link:` to a local checkout) and expose it as a `flows` script so it
  runs as `pnpm flows` / `pnpm exec whatsapp-flow`. If you `link:` a local checkout,
  the link points at the framework's built `dist/` — run `pnpm -r build` in the
  framework once after cloning or editing its source.

## A flow is a file

Each flow is one `.tsx` file exporting its config (`flow`) plus one PascalCase
function per screen. The export **must** be named `Index` — that's the start
screen at `/`. Other exports route to `/<kebab-of-export-name>`. Link screens by
route; the compiler infers the `routing_model` from your `<Next>` / `<Exchange>`
links.

`flows/flows.config.ts` — the project config ("next.config.ts" of flows):

```ts
import { defineFlowsApp, fromCommand } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.3",                                  // default Flow JSON version
  wabas: {                                         // named deploy targets
    dev: { id: "2142644013223594" },
    prod: { id: "26870122239247230" },
  },
  defaultEnv: "dev",                               // used when --env / WHATSAPP_ENV unset
  token: fromCommand("convex env get WHATSAPP_ACCESS_TOKEN"), // optional; see below
});
```

Declare one or more **named environments** under `wabas`. Pick the target with
`--env <name>`, the `WHATSAPP_ENV` var, or `defaultEnv` (a single env is
auto-picked). The committed `flows.lock.json` is **keyed by env name**, so it holds
dev and prod state side by side with stable keys. `token` controls how `push` gets
the Graph API token — a string, a JSON-friendly `{ command: "…" }`, the
`fromCommand("…")` helper, or a function `(ctx) => string`; omit it to fall back to
`WHATSAPP_ACCESS_TOKEN`. (`fromCommand` is a shell-*out*, not a shell: it splits on
whitespace, no quoting/pipes.)

`flows/grocery.tsx` — one flow:

```tsx
import { defineFlow, Screen, Form, TextArea, TextBody, Footer, Next, Complete, field } from "whatsapp-flow-tsx";

export const flow = defineFlow({
  // name defaults to the filename ("grocery"); set `name` to override.
  categories: ["LEAD_GENERATION"],
  // version inherits the app; dataApiVersion + endpointUri are per-flow.
});

export function Index() {                  // required: start screen at "/" → id START
  return (
    <Screen title="Start your order">
      <Form>
        <TextArea name="shopping_list" label="What should we buy?" required />
        <Footer>
          <Next to="/confirm" data={{ shopping_list: field("shopping_list") }}>Continue</Next>
        </Footer>
      </Form>
    </Screen>
  );
}

export function Confirm() {                 // "/confirm" → screen id CONFIRM
  return (
    <Screen title="Confirm" success>
      <Form>
        <TextBody>Place your order?</TextBody>
        <Footer><Complete data={{ shopping_list: field("shopping_list") }}>Submit</Complete></Footer>
      </Form>
    </Screen>
  );
}
```

`categories` valid values: `SIGN_UP`, `SIGN_IN`, `APPOINTMENT_BOOKING`,
`LEAD_GENERATION`, `CONTACT_US`, `CUSTOMER_SUPPORT`, `SURVEY`, `OTHER`. Author the
catalog of components, actions, and reference helpers from
[references/authoring.md](references/authoring.md) — read it before writing screens
so you use real prop names and the right composition patterns.

## Compile & push

Run from the app root. `pnpm flows` is the `whatsapp-flow` CLI; commands act on the
whole app (every flow), no path needed.

```bash
pnpm flows check             # validate every flow (run often while authoring)
pnpm flows inspect           # outline every flow: screens, ids, transitions
pnpm flows build             # compile all → flows/.build/<name>.json (for inspection)

pnpm flows push --dry-run    # show what would sync to Meta (create/update/skip)
pnpm flows push              # sync + publish to the resolved env's WABA
pnpm flows push --env prod   # target a specific env

pnpm flows ids                              # resolved env's locked ids as JSON (push auto-writes the typed module)
pnpm flows ids --env prod                   # ids for a specific env
pnpm flows ids --env-line                   # WHATSAPP_FLOWS='{...}' one-liner
pnpm flows ids --out path/to/ids.ts         # custom path for the typed all-envs module

pnpm flows templates                        # list LIVE templates on Meta (name/lang/category/status/id)
pnpm flows templates --all-envs             # same, for every configured env's WABA
```

`templates` is the only live read: it queries Meta's `/{WABA}/message_templates`
(needs an access token) and shows each template's review `status`, so it answers
"which templates are live on this WABA, and in what category".

Every command takes `--env <name>` and walks up from the cwd to find
`flows.config.ts` (so it works from a subdirectory). Config can also live in
`package.json#whatsappFlows` instead of a `flows.config.ts`.

A `flows.lock.json` from before named envs (v1, keyed by raw WABA id) is rejected
with an upgrade hint. Migrate it by hand once: set `"version": 2` and replace the
top-level `"wabas"` map with `"envs"`, moving each WABA's entries under the env name
that targets it — `"envs": { "<env>": { "wabaId": "<id>", "assets": { …old map… } } }`.

`push` needs an access token — from `token` in `flows.config.ts` or, by default,
`WHATSAPP_ACCESS_TOKEN` (e.g. `dotenvx run -f .env.local -- whatsapp-flow push`). It
compiles every flow, then per flow: **creates** on Meta if new (adopting a live flow
by matching name on first push), **replaces** the JSON if its content hash changed,
or **skips** it if unchanged. Every touched flow is **published immediately** —
there is no draft gate. Iterate in app code with feature flags, not by holding back
publish. `push` targets exactly one env; to deploy to both dev and prod, run it
twice (`--env dev`, then `--env prod`).

After a successful push, the typed ids module is **auto-written** to
`<flowsDir>/whatsapp-flows.generated.ts` (override via `generatedIdsPath` in
`flows.config.ts`). It exports all envs plus `flowId(name, env?)` /
`templateId(name, env?)` helpers (env defaults to `WHATSAPP_ENV`), so app code does
`flowId("woolworths_connect")`. Commit the file or gitignore + regenerate in CI —
your call. `flows ids` is for printing/exporting in non-default formats.

`inspect` is a text outline, not a faithful render of WhatsApp's UI.

## Reference helpers

Don't hand-write Meta reference strings like `${form.x}`. Use:

| Helper | Compiles to | Means |
| --- | --- | --- |
| `field("x")` | `${form.x}` | a value entered into the current screen's form |
| `data("x")` | `${data.x}` | a value from the current screen's input data |
| `screenData("/confirm", "x")` | `${screen.CONFIRM.data.x}` | a value carried by another screen |

A value passed forward in a `<Next data={…}>` arrives on the next screen as `data`.
Declare what a screen receives via the `<Screen data={…}>` schema so it's available
to `data("…")`. See the multi-screen example in
[references/authoring.md](references/authoring.md).

## Images

WhatsApp embeds image **bytes** in the Flow JSON — there is no runtime URL fetch —
so an image's data must be **base64** by compile time. The compiler does this for
you: **just put a file path or URL in `src` and it is encoded to base64 during the
build.** No helper to import, no `await`.

```tsx
import { Screen, Image, ImageCarousel, CarouselImage } from "whatsapp-flow-tsx";

export function Specials() {
  return (
    <Screen title="Specials">
      <Image src="../public/braai.png" altText="Braai pack" scaleType="cover" />
      <ImageCarousel scaleType="cover">
        <CarouselImage src="../public/pack-1.png" altText="Pack 1" />
        <CarouselImage src="https://cdn.example.com/pack-2.png" altText="Pack 2" />
      </ImageCarousel>
    </Screen>
  );
}
```

What `src` accepts (same for `<Image>`, `<CarouselImage>`, and the `image` prop on
`<Option>` / `<NavItem>`):

- **A relative path** → resolved against the **flow file's own directory**. A flow
  file is `flows/<name>.tsx`, so the app's `public/` is `../public/`.
- **An absolute path** or `file://` URL → read from disk as-is.
- **An `http(s)` URL** → fetched at build time.
- **A bare base64 string** → passed through unchanged (already encoded).

Detection keys off the scheme or a trailing image extension (`.png`, `.jpg`,
`.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`), so base64 is never mistaken for a path.
Keep the source files in the app's `public/` directory. A bad path or a failed
fetch fails the compile with a clear error naming the screen.

**Keep images small** — the base64 lands inside the flow JSON, so a 380 KB photo
becomes ~516 KB of JSON, and Meta enforces an upload-time size limit. Resize/optimize
first (≈600 px wide is plenty for a banner; ~100 KB encodes comfortably). Confirm
Meta's current exact limit before shipping a heavy flow.

## Validation

Every `check`/`build`/`push` runs two layers and **fails the compile** on any error:

1. **Semantic checks** with route-scoped, human-readable messages: a `<Next to>`
   pointing at a route with no screen, duplicate screen ids, duplicate field names
   within a form (recursing through `If`/`Switch`), a `Footer` without exactly one
   action, terminal/complete mismatches, inputs outside a `Form`, unsupported
   components, and unserializable values.
2. **Formal verification:** the compiled JSON is checked against a generated JSON
   Schema with Ajv — an engine independent of the builder — rejecting unknown
   component/action types, stray keys, bad enum values, missing required props, and
   wrong value types.

Read the error, fix the screen, re-run `check`. Errors name the offending flow and
screen. The compiler is always strict: dead-end screens and terminal screens
without `<Complete>` are errors, not warnings.

## Handoff: lower-level lifecycle

`flows push` handles compile + create/update + publish. For everything else on flows
already on Meta — **preview, deprecate, delete, send a flow to a user, migrate
between WABAs, list, or check status/approval** — use a Meta Graph API CRUD workflow
(the `POST/GET/DELETE /{flow_id}` and `/{WABA_ID}/flows` endpoints), which owns
those Graph API operations and the phone-number ids. Don't reimplement those here.
For **message templates** (a different asset entirely), use the
**`whatsapp-template-tsx`** skill.

## Data-exchange (endpoint) flows

Flows that call your server mid-flow via `<Exchange>` need a one-time
provisioning step before the first `flows push`: upload an RSA-2048 public key
to the phone number (per-number, shared across flows) and set `endpoint_uri`
on the flow asset (per-flow). Without those, publish fails with Meta error
139002. The runtime endpoint speaks an encrypted protocol (RSA-OAEP unwrap +
AES-128-GCM, response IV flipped). See
[references/endpoint.md](references/endpoint.md) for the full wire protocol,
provisioning curls, and a Node.js reference implementation; see
[references/authoring.md § Data-exchange flows](references/authoring.md#data-exchange-endpoint-flows)
for the TSX-side patterns (static routing constraints, the `SUCCESS` magic
terminal, and the `error_message` magic data field for inline retry UX).

## Sharp edges

- **Author in TSX, not raw JSON.** If you're tempted to hand-edit compiled JSON,
  change the `.tsx` and recompile instead — the JSON is a build artifact.
- **One flow per file.** Screens are PascalCase function exports; the `Index`
  export is required and is the start at `/`. Other exports route to
  `/<kebab-name>`; link them with `<Next to="/that-route">`.
- **One action per `Footer`.** `Footer` takes exactly one of `<Next>`, `<Complete>`,
  `<Exchange>`, `<OpenURL>`, `<UpdateData>` as its child. Inputs that act on
  selection take an action element directly (e.g. `onSelectAction={<UpdateData …/>}`).
- **Choices/lists are children, not array props.** `Dropdown`/`RadioButtonsGroup`/
  `CheckboxGroup`/`ChipsSelector` take `<Option>` children; `NavigationList` takes
  `<NavItem>`; `ImageCarousel` takes `<CarouselImage>`.
- **Inputs must live inside a `<Form>`**, and field `name`s must be unique per form.
- **`If`/`Switch` are client-side** conditional rendering — no endpoint round-trip.
  Use `<Exchange>` (a `data_exchange` action) only when you genuinely need live data
  from an endpoint.
- **Confirm `version` for production.** Default `7.3`; component shapes follow Meta's
  current Flow JSON docs — verify the exact version against Meta before shipping.
