# WhatsApp message templates (TSX → Meta template payload)

A **message template** is a pre-approved message you *send* to a user to start a
conversation — order updates, marketing, one-time passcodes — as opposed to an
interactive flow. Templates are WABA-scoped assets that go through Meta review.
This framework authors them as `.tsx` files in the same `flows/` app as flows, and
`flows push` creates/edits them per WABA.

A template `.tsx` file:

- **exports `template`** — a `defineTemplate({...})` config. Its presence is what
  marks the file as a template (otherwise the file is compiled as a flow).
- **default-exports** a function returning a `<Template>` (a bare `<Template>` node
  also works; a function lets you declare variables as locals first).

```tsx
import { defineTemplate, Template, v, tpl } from "whatsapp-flow-tsx";

export const template = defineTemplate({
  category: "MARKETING",          // MARKETING | UTILITY | AUTHENTICATION  (required)
  // language: "en_US",           // defaults to app `language`, else "en_US"
  // name: "welcome",             // defaults to filename, lowercased
  // allowCategoryChange: false,  // default false: Meta must approve THIS category
});

export default function Welcome() {
  const name = v("name", "Sam");
  return (
    <Template>
      <Template.Header>Welcome to Acme, {name}</Template.Header>
      <Template.Body>
        Hey {name}, you're user #{v("number", "42")}. Thanks for joining.
      </Template.Body>
      <Template.Footer>Reply STOP to unsubscribe</Template.Footer>
      <Template.Buttons>
        <Template.URL text="Open Acme" url="https://acme.com/welcome" />
        <Template.Reply>Not now</Template.Reply>
      </Template.Buttons>
    </Template>
  );
}
```

## Components — the `Template.*` namespace

Structural pieces are namespaced under `Template.*` so they never collide with the
flow components (which also have a `Footer`, `Image`, etc.). Compose them as
children of `<Template>`:

| Element | Meta component | Notes |
| --- | --- | --- |
| `<Template.Header>` | `HEADER` (`format: "TEXT"`) | Optional. Text from children. **≤ 1 variable.** Media headers: see below. |
| `<Template.Body>` | `BODY` | **Required, exactly one.** Text from children; any number of variables. |
| `<Template.Footer>` | `FOOTER` | Optional. Static text only — **no variables**. |
| `<Template.Buttons>` | `BUTTONS` | Optional. Up to 10 button children. |
| `<Template.URL text url>` | `URL` button | `url` is a string or a `tpl` with one trailing variable. |
| `<Template.Reply>` | `QUICK_REPLY` button | Label from `text` prop or children. |
| `<Template.Phone text phoneNumber>` | `PHONE_NUMBER` button | Static phone number. |

Only `Template.Body` is required. Order of the sections in the source doesn't
matter — the compiler emits them in Meta's order (HEADER, BODY, FOOTER, BUTTONS).

## Variables and examples

Meta templates use positional `{{1}}`, `{{2}}` placeholders in the text **and** a
separate array of example values that the review team sees. Keeping the indices and
the example array in sync by hand is the most error-prone part of a template.

Instead, declare each variable **once, with its example**, using `v(name, example)`,
and place it directly in the text:

```tsx
<Template.Body>Hi {v("name", "Sam")}, your order {v("order", "A1234")} shipped.</Template.Body>
```

The compiler:

- **numbers placeholders per component** — header variables and body variables each
  start at `{{1}}` independently (this matches Meta's per-component numbering);
- **dedupes by name** — reusing `v("name", …)` reuses the same index, so you provide
  the example once per component;
- **assembles the example arrays** Meta requires.

`name` is just an identifier for dedup and error messages; the output is always
positional (`{{1}}`), which every WABA accepts. The **example is mandatory** — a
variable with an empty example fails the compile.

### Variables inside a string prop — `` tpl`…` ``

A variable as a JSX child works for visible text. For a variable inside a *prop*
(the dynamic suffix of a URL button), use the `` tpl`…` `` tagged template, which
preserves the structure a plain JS template string would flatten:

```tsx
<Template.URL text="Track order" url={tpl`https://acme.com/track/${v("order", "A1234")}`} />
```

Meta requires a URL button to have **at most one** variable and it must be **at the
end** of the URL; both are enforced at compile time.

## Compiled payload

The `Welcome` template above compiles to exactly the payload Meta's
`POST /{WABA_ID}/message_templates` endpoint accepts:

```json
{
  "name": "welcome",
  "language": "en_US",
  "category": "MARKETING",
  "allow_category_change": false,
  "components": [
    { "type": "HEADER", "format": "TEXT", "text": "Welcome to Acme, {{1}}",
      "example": { "header_text": ["Sam"] } },
    { "type": "BODY", "text": "Hey {{1}}, you're user #{{2}}. Thanks for joining.",
      "example": { "body_text": [["Sam", "42"]] } },
    { "type": "FOOTER", "text": "Reply STOP to unsubscribe" },
    { "type": "BUTTONS", "buttons": [
      { "type": "URL", "text": "Open Acme", "url": "https://acme.com/welcome" },
      { "type": "QUICK_REPLY", "text": "Not now" }
    ]}
  ]
}
```

A URL button with a variable carries its filled example:

```json
{ "type": "URL", "text": "Track order", "url": "https://acme.com/track/{{1}}",
  "example": ["https://acme.com/track/A1234"] }
```

Run `flows build` to write each template to `flows/.build/<name>.template.json`, or
`flows inspect` for a compact text outline (text with placeholders + example values).

## Media headers

Image/video/document headers need an **example media handle** obtained from Meta's
resumable upload API (this framework does not upload media for you). Supply it:

```tsx
<Template.Header format="IMAGE" handle="4::aW1hZ2U…" />
// → { "type": "HEADER", "format": "IMAGE", "example": { "header_handle": ["4::aW1hZ2U…"] } }
```

Text headers are the common case and need no handle. To obtain a handle, run Meta's
Graph API resumable upload session (`/app/uploads` → upload → `file_handle`).

## Authentication templates

`category: "AUTHENTICATION"` is accepted, but Meta requires a specific structure
(OTP button, security disclaimers) that this layer does not special-case. Author the
body/buttons as usual and let Meta validate, or build the authentication-specific
payload shape directly against the Graph API.

## Push behavior

`flows push` reconciles each template against Meta and `flows.lock.json` (key
`tpl:<name>@<language>`, per WABA):

- **create** — no lock entry and no live template of the same name+language →
  `POST /{WABA}/message_templates`. This **submits the template for review**; the
  create response is usually `PENDING`.
- **adopt** — a live template with the same name+language is adopted by name (its id
  and status recorded) rather than duplicated.
- **edit** — a changed template → `POST /{template_id}` with the new `components`.
  Meta only permits edits in certain review states (not while `PENDING`); the Graph
  error is surfaced if it refuses.
- **skip** — unchanged (same content hash).

Templates go live through Meta's async review, not a publish call — push's
auto-publish behavior for flows doesn't apply. `push --dry-run` previews the plan.
Template ids differ per WABA even for identical content; switch targets by switching
env file, not by passing a flag.

## Authoring rules (enforced at compile time)

- Exactly one `<Template.Body>`; it must be non-empty.
- At most one `<Template.Header>` / `<Template.Footer>` / `<Template.Buttons>`.
- Header: at most one variable.
- Footer: no variables (static text only).
- URL button: at most one variable, at the end of the URL.
- Every variable needs a non-empty example.
- Name must be lowercase letters, numbers, and underscores (`[a-z0-9_]+`).
- `category` ∈ {MARKETING, UTILITY, AUTHENTICATION}.
- ≤ 10 buttons.

## Sharp edges (Meta behavior)

- **Approval is async.** A successful create is usually `PENDING`; re-list via the
  Graph API (`GET /{WABA_ID}/message_templates`) before treating a template as
  live/sendable. Only `APPROVED` is sendable.
- **Category recategorization.** With `allowCategoryChange: false` (the default),
  Meta must approve the category you authored — it may **reject** rather than
  silently move a mis-categorized template. UTILITY must be transactional; if a
  promotional message is filed as UTILITY, expect a MARKETING reclassification or a
  rejection.
- **Same-name cooldown.** A deleted template name can be blocked for a while;
  approved-and-used templates resist same-name recreation. Bump the name if needed.
- **Editing.** Prefer editing components of a non-pending template; for a pending or
  rejected draft it is often cleaner to delete (`DELETE /{template_id}`) and recreate.
- **Sending** a template (by `name` + `language` to a phone-number id's `/messages`
  endpoint) is **not** this skill's job — handle it via the Graph API directly.
