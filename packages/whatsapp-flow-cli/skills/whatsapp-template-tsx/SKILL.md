---
name: whatsapp-template-tsx
description: Author, compile, and push WhatsApp message templates written as TypeScript/TSX. Use whenever the user wants to write, build, edit, compile, validate, or deploy a WhatsApp/Meta message template — the pre-approved text/media messages you send to start a conversation (order updates, marketing, OTP/authentication) with {{1}} variables, header/body/footer, and URL/quick-reply/phone buttons — even if they don't say "TSX". Templates are .tsx files that export `template` (a defineTemplate config) in the same flows/ app as Flows; a v()/tpl variable DX keeps Meta's positional placeholders in sync with the examples it requires. Also for fixing template validation errors and for `flows push` (creating/editing templates for Meta review). Prefer this over hand-writing raw template payloads. To author interactive multi-screen Flows instead, use the companion whatsapp-flow-tsx skill. For lower-level Graph API lifecycle — list, send, delete, status/approval — use a Meta Graph API CRUD workflow.
---

# WhatsApp message template authoring (TSX → Meta template payload)

A **message template** is a pre-approved message you *send* to a user to start a
conversation — order updates, marketing, one-time passcodes — as opposed to an
interactive [Flow](#relationship-to-flows). Templates are WABA-scoped assets that go
through Meta's async review (`PENDING` → `APPROVED`/`REJECTED`). This framework
authors them as `.tsx` files and compiles them to the exact payload Meta's
`POST /{WABA_ID}/message_templates` endpoint accepts.

**This is a compile-time authoring layer, not a runtime.** The `.tsx` runs once, at
build time, to emit the template payload. The headline DX win is **variables and
their examples in one place** — see [Variables and examples](#variables-and-examples).

## Relationship to Flows

Templates live in the **same `flows/` app** as Flows and share its config
(`flows.config.ts`), CLI (`whatsapp-flow` / `pnpm flows`), and lockfile
(`flows.lock.json`). A `.tsx` file is a **template** when it **exports `template`** (a
`defineTemplate({...})` config); without that export it's compiled as a Flow. For the
full app layout, the CLI, images, and Flow authoring, see the companion
**`whatsapp-flow-tsx`** skill. The minimum you need here:

```ts
// flows/flows.config.ts
import { defineFlowsApp } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  language: "en_US",                              // default language for templates
  wabas: {                                        // named deploy targets
    dev: { id: "2142644013223594" },
    prod: { id: "26870122239247230" },
  },
  defaultEnv: "dev",
});
```

Declare named environments under `wabas`; select one with `--env <name>`,
`WHATSAPP_ENV`, or `defaultEnv`. See the `whatsapp-flow-tsx` skill for the full
dev/prod workflow and token config.

## A template is a file

```tsx
// flows/welcome.tsx  →  template "welcome"
import { defineTemplate, Template, v, tpl } from "whatsapp-flow-tsx";

export const template = defineTemplate({ category: "MARKETING" });
// category: MARKETING | UTILITY | AUTHENTICATION (required).
// language defaults to the app `language` or "en_US"; name defaults to the
// filename (lowercased) and can be set per-template; allowCategoryChange
// defaults to false.

export default function Welcome() {
  const name = v("name", "Sam");            // a variable + its example, declared once
  return (
    <Template>
      <Template.Header>Welcome to Acme, {name}</Template.Header>
      <Template.Body>
        Hey {name}, you're user #{v("number", "42")}. Thanks for joining.
      </Template.Body>
      <Template.Footer>Reply STOP to unsubscribe</Template.Footer>
      <Template.Buttons>
        <Template.URL text="Open Acme" url="https://acme.com/welcome" />
        <Template.URL text="Track" url={tpl`https://acme.com/track/${v("order", "A1")}`} />
        <Template.Reply>Not now</Template.Reply>
        <Template.Phone text="Call us" phoneNumber="+15551234567" />
      </Template.Buttons>
    </Template>
  );
}
```

The `template` export marks the file; a default function returning `<Template>` is the
body (a bare `<Template>` node also works — a function just lets you declare variables
as locals first).

## Components — the `Template.*` namespace

Structural pieces are namespaced under `Template.*` so they never collide with Flow
components (which also have a `Footer`, `Image`, etc.). Compose them as children of
`<Template>`:

| Element | Meta component | Notes |
| --- | --- | --- |
| `<Template.Header>` | `HEADER` (`format: "TEXT"`) | Optional. Text from children. **≤ 1 variable.** Media headers (`format="IMAGE"` + `handle`) — see references. |
| `<Template.Body>` | `BODY` | **Required, exactly one.** Any number of variables. |
| `<Template.Footer>` | `FOOTER` | Optional. Static text only — **no variables**. |
| `<Template.Buttons>` | `BUTTONS` | Optional. Up to 10 button children. |
| `<Template.URL text url>` | `URL` button | `url` is a string or a `tpl` with one trailing variable. |
| `<Template.Reply>` | `QUICK_REPLY` button | Label from `text` prop or children. |
| `<Template.Phone text phoneNumber>` | `PHONE_NUMBER` button | Static phone number. |

Source order doesn't matter — the compiler emits Meta's order (HEADER, BODY, FOOTER,
BUTTONS).

## Variables and examples

Meta needs `{{1}}`-style placeholders in the text **and** a parallel array of example
values that the review team sees; keeping the indices and the example array in sync by
hand is the classic template footgun. Instead, declare each variable **once, with its
example**, using `v("name", "example")`, and drop it directly into the text:

```tsx
<Template.Body>Hi {v("name", "Sam")}, your order {v("order", "A1234")} shipped.</Template.Body>
```

The compiler **numbers placeholders per component** (header and body each start at
`{{1}}` independently — matching Meta's per-component numbering), **dedupes by name**
(reuse `v("name", …)` and it reuses the same index, so you give the example once per
component), and **assembles the example arrays** Meta requires (`header_text`,
`body_text`). The `name` is just an identifier for dedup and error messages; output is
always positional. The **example is mandatory** — an empty example fails the compile.

For a variable inside a **string prop** (a URL button's dynamic suffix), use the
`` tpl`…` `` tagged template — it carries the same `v(...)` into the string and fills
the example URL:

```tsx
<Template.URL text="Track order" url={tpl`https://acme.com/track/${v("order", "A1234")}`} />
```

A URL button takes **at most one** variable and it must be **at the end** of the URL;
both are enforced at compile time.

`Welcome` above compiles to (see [references/templates.md](references/templates.md)
for the full payload):

```json
{ "type": "BODY", "text": "Hey {{1}}, you're user #{{2}}. Thanks for joining.",
  "example": { "body_text": [["Sam", "42"]] } }
```

## Compile & push

Run from the app root; commands act on every flow and template in the app.

```bash
pnpm flows check             # validate every flow + template (run often)
pnpm flows inspect           # outline templates: text with {{n}} + example values
pnpm flows build             # compile all → flows/.build/<name>.template.json
pnpm flows push --dry-run    # show what would sync to Meta (create/edit/skip)
pnpm flows push              # create/edit templates on the current env's WABA
```

`push` reconciles each template against Meta and `flows.lock.json` (key
`tpl:<name>@<language>`, per WABA id):

- **create** — no lock entry and no live template of that name+language →
  `POST /{WABA}/message_templates`, which **submits it for review** (response is
  usually `PENDING`). A live template with the same name+language is **adopted** by
  name rather than duplicated.
- **edit** — content hash changed → `POST /{template_id}` with the new `components`.
  Meta only permits edits in certain review states (not while `PENDING`).
- **skip** — unchanged.

Templates go live through Meta's async review, not a publish call — push's auto-publish
behavior for flows doesn't apply to templates. Ids differ per WABA even for identical
content. After push, the typed ids module (auto-written for flows) also includes
`WHATSAPP_TEMPLATES`.

## Validation (enforced at compile time, fails the build)

- Exactly one `<Template.Body>`, non-empty.
- At most one `<Template.Header>` / `<Template.Footer>` / `<Template.Buttons>`.
- Header: ≤ 1 variable. Footer: **no variables** (static text only).
- URL button: ≤ 1 variable, at the **end** of the URL.
- Every variable needs a **non-empty example**.
- Name must be lowercase letters, numbers, underscores (`[a-z0-9_]+`).
- `category` ∈ {MARKETING, UTILITY, AUTHENTICATION}; ≤ 10 buttons.

Read [references/templates.md](references/templates.md) for the full component/button
catalog, the exact compiled payloads, media headers, authentication templates, and
Meta's sharp edges (async approval, category recategorization, same-name cooldown)
**before writing a template**.

## Handoff: lower-level lifecycle

`flows push` handles compile + create/edit templates for review. For everything else on
templates already on Meta — **list, send a template to a user, delete, or check
status/approval** — use a Meta Graph API CRUD workflow (the
`/{WABA_ID}/message_templates`, `POST/DELETE /{template_id}`, and the phone-number
`/messages` send endpoints), which owns those Graph API operations and the
phone-number ids. Don't reimplement those here. For interactive multi-screen
**Flows** (a different asset), use the **`whatsapp-flow-tsx`** skill.

## Sharp edges

- **Author in TSX, not raw JSON.** Change the `.tsx` and recompile — the payload is a
  build artifact.
- **Approval is async.** A successful create is usually `PENDING`; only `APPROVED`
  templates are sendable. Re-check status via the Graph API before relying on one.
- **Category may be recategorized.** With `allowCategoryChange: false` (default) Meta
  must approve the category you authored, and may **reject** rather than silently move
  a mis-categorized template. UTILITY must be transactional.
- **Footers can't hold variables; URL variables go last.** Both are common rejections —
  the compiler catches them for you.
- **Same-name cooldown.** A deleted/approved template name can be blocked from
  recreation for a while; bump the name if Meta refuses.
