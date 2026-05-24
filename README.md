# whatsapp-flows

Author **Meta WhatsApp Flows** as TypeScript/TSX files with a tiny, Next.js-style
file-based router, compile them to valid **Flow JSON**, and push them to Meta —
along with **message templates**, authored the same way in the same app.


## Why

Because

## Packages

| Package | Purpose |
| --- | --- |
| `whatsapp-flow-core` | Flow JSON types, component registry, generated JSON Schema + Ajv verifier, reference helpers, normalizer, validator. Usable without TSX. |
| `whatsapp-flow-tsx` | Custom JSX runtime + authoring components (`Screen`, `Form`, `TextArea`, `Next`, …) + `defineFlow` / `defineFlowsApp`, plus message-template components (`Template`, `v`, `tpl`) + `defineTemplate`. No React. |
| `whatsapp-flow-cli` | Flow discovery, route→screen-id mapping, routing model, validation, image encoding, template compilation, the Meta push pipeline (flows + templates), and the `whatsapp-flow` CLI. |

## A flows app

A flows app is a directory with a `flows.config.ts` and one `.tsx` file per flow
(or per message template). A single `whatsapp-flow push` compiles and syncs them all.

```
flows/
  flows.config.ts        project config (the "next.config.ts" of flows)
  grocery.tsx            one flow  ->  name "acme_grocery"
  woolworths-login.tsx   one flow  ->  name "acme_woolworths_login"
  flows.lock.json        committed; maps each flow to its Meta id per WABA
```

`flows.config.ts`:

```ts
import { defineFlowsApp } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.3",            // default Flow JSON version for every flow
  namePrefix: "acme_",       // file name → flow name (grocery.tsx → acme_grocery)
  categories: ["SIGN_IN"],   // default categories
  wabas: { prod: { id: "…" }, dev: { id: "…" } },
  defaultWaba: "dev",        // which WABA `push` targets by default
});
```

### A flow is a file

Each `.tsx` exports its config as `flow` plus one **PascalCase function per screen**.
The export **must** be named `Index` — that's the start screen at route `/`. Every
other export routes to `/<kebab-of-export-name>`. Link screens by route; the
compiler infers the `routing_model` from your links.

```tsx
// flows/grocery.tsx
import { defineFlow, Screen, Form, TextArea, TextBody, Footer, Next, Complete, field } from "whatsapp-flow-tsx";

export const flow = defineFlow({
  // name defaults to namePrefix + filename ("acme_grocery"); override here.
  categories: ["LEAD_GENERATION"],
  // version + categories inherit the app; dataApiVersion + endpointUri are per-flow.
});

export function Index() {                    // required: start screen at "/" → id START
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

export function Confirm() {                   // "/confirm" → screen id CONFIRM
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

See [`examples/grocery-order`](examples/grocery-order) for a complete flows-app
example.

To make the JSX type-check in your editor, point TypeScript at the custom runtime:

```json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "whatsapp-flow-tsx" } }
```

## Message templates

The same app can also hold **WhatsApp message templates** — the pre-approved
text/media messages you send to *start* a conversation (order updates, marketing
blasts), as opposed to interactive flows. A `.tsx` file is a template when it
exports `template` (a `defineTemplate({...})` config) instead of screens; it lives
in the same `flows/` directory and pushes to the same WABAs.

```tsx
// flows/welcome.tsx  →  template "acme_welcome"
import { defineTemplate, Template, v } from "whatsapp-flow-tsx";

export const template = defineTemplate({ category: "MARKETING" });

export default function Welcome() {
  const name = v("name", "Sam");            // a variable and its example, in one place
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

**Variables and examples, in one place.** Meta wants `{{1}}`-style placeholders in
the text *and* a parallel array of example values for review — kept in sync by
hand, this is the most error-prone part of a template. Here you declare a variable
once with `v("name", "example")`, drop it straight into the text, and the compiler
numbers the placeholders **per component** (deduping repeats) and assembles the
example arrays. The `welcome` template above compiles to:

```json
{ "type": "HEADER", "format": "TEXT", "text": "Welcome to Acme, {{1}}",
  "example": { "header_text": ["Sam"] } },
{ "type": "BODY", "text": "Hey {{1}}, you're user #{{2}}. Thanks for joining.",
  "example": { "body_text": [["Sam", "42"]] } }
```

For a variable inside a string prop — e.g. the dynamic suffix of a URL button — use
the `` tpl`…` `` tagged template, which carries the same `v(...)` into the string
and fills the example URL automatically:

```tsx
<Template.URL text="Track order" url={tpl`https://acme.com/track/${v("order", "A1234")}`} />
// → url "https://acme.com/track/{{1}}", example ["https://acme.com/track/A1234"]
```

`defineTemplate` fields: `category` (`MARKETING` | `UTILITY` | `AUTHENTICATION`,
required), `language` (defaults to the app `language` or `en_US`), `name` (defaults
to `namePrefix` + filename, lowercased), and `allowCategoryChange` (default `false`,
so Meta must approve the category you chose rather than silently re-categorizing).
Compile-time checks enforce Meta's structural rules: exactly one body, at most one
variable in a header, no variables in a footer, a single trailing variable in a URL,
and a non-empty example for every variable.

## CLI

Run from the app root; commands act on every flow and template.

```bash
whatsapp-flow check                  # validate every flow and template
whatsapp-flow inspect                # outline each flow (routes/ids) and template (text/vars)
whatsapp-flow build                  # compile all → flows/.build/ (<name>.json, <name>.template.json)
whatsapp-flow push --dry-run         # show what would sync to Meta (create/update/edit/skip)
whatsapp-flow push                   # sync drafts to Meta
whatsapp-flow push --publish         # sync + publish (goes live)
whatsapp-flow push --waba both       # target every configured WABA (default: defaultWaba)

whatsapp-flow schema  --out flow.schema.json        # emit the JSON Schema used for verification
```

`inspect` is a lightweight text preview (route map + transitions + per-screen
outline) — **not** a faithful render of WhatsApp's UI.

## Push & deploy

`push` compiles every flow, then reconciles it against Meta and a committed
**`flows.lock.json`** (scoped per WABA: `name → { id, rev, hash }`):

- **Change detection** — each compiled flow is hashed; an unchanged flow is **skipped**.
- **Create / adopt** — a flow with no lock entry is created as a Meta draft; if a live
  flow already exists with the same name, it is **adopted by name** rather than
  duplicated, and its id is recorded.
- **Update** — a changed flow's JSON is re-uploaded to its existing draft.
- **Versioning** — `rev` in the lockfile bumps on every change.
- **Publish gate** — drafts are synced by default; going live requires `--publish`.

**Templates** ride the same pipeline and lockfile. A template with no lock entry
(and no live template of the same name + language) is **created**, which submits it
to Meta for review; a changed template is **edited** in place; an unchanged one is
**skipped**. `--publish` doesn't apply — templates go live through Meta's async
review rather than a publish call — and the lockfile records each template's last
known review status (e.g. `PENDING`). Template keys are scoped `tpl:<name>@<language>`.

`push` needs `WHATSAPP_ACCESS_TOKEN` in the environment. Load it however you like,
e.g. `dotenvx run -f .env.local -- whatsapp-flow push`. Start with `push --dry-run`
to preview the plan.

Configuring a flow's `endpoint_uri` (for data-exchange flows) is **not** done by
`push`; set it via the Graph API / Flow Builder separately.

## Images

WhatsApp embeds image **bytes** in the Flow JSON — there is no runtime URL fetch — so
the data must be **base64** by compile time. The compiler handles this: **put a file
path or URL in `src` (or the `image` prop) and it is encoded during the build.** No
helper, no `await`.

```tsx
<Image src="../public/braai.png" altText="Braai pack" scaleType="cover" />
<ImageCarousel scaleType="cover">
  <CarouselImage src="../public/pack-1.png" altText="Pack 1" />
  <CarouselImage src="https://cdn.example.com/pack-2.png" altText="Pack 2" />
</ImageCarousel>
```

`src` / `image` accept: a **relative path** (resolved against the flow file's own
directory — for a `flows/<name>.tsx` flow, the app's `public/` is `../public/`), an
**absolute path** or `file://` URL (read from disk), an **`http(s)` URL** (fetched at
build), or a **bare base64 string** (passed through). Detection keys off the URL
scheme or a trailing image extension (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`,
`.bmp`, `.svg`), so base64 is never mistaken for a path. A bad path or failed fetch
fails the compile with an error naming the screen. Keep images small — the base64
lands inside the JSON and Meta enforces an upload size limit.

## Reference helpers

Don't hand-write Meta reference strings. Use:

| Helper | Compiles to | Means |
| --- | --- | --- |
| `field("x")` | `${form.x}` | a value entered into the current screen's form |
| `data("x")` | `${data.x}` | a value from the current screen's input data |
| `screenData("/confirm", "x")` | `${screen.CONFIRM.data.x}` | a value carried by another screen |

## Components

Every component in Meta's current Flow JSON catalog is supported. The screen
layout (Meta's `SingleColumnLayout`) is implicit — write `<Screen><Form>…</Form></Screen>`
directly.

- **Structure:** `Screen`, `Form`, `Footer`, `If`, `Switch`
- **Text / display:** `TextHeading`, `TextSubheading`, `TextBody`, `TextCaption`, `RichText`, `Image`, `ImageCarousel`, `EmbeddedLink`
- **Inputs:** `TextInput`, `TextArea`, `Dropdown`, `RadioButtonsGroup`, `CheckboxGroup`, `ChipsSelector`, `OptIn`, `DatePicker`, `CalendarPicker`, `PhotoPicker`, `DocumentPicker`
- **Navigation:** `NavigationList`

### Actions

`Next` → `navigate`, `Complete` → `complete` (terminal), `Exchange` → `data_exchange`,
`OpenURL` → `open_url`, `UpdateData` → `update_data`.

A `Footer` takes one action as its child. Components with action properties
(`onClickAction`, `onSelectAction`, …) take an action element directly:

```tsx
<Dropdown name="size" label="Size"
  onSelectAction={<UpdateData data={{ chosen: field("size") }} />}>
  <Option id="s" title="Small" />
  <Option id="m" title="Medium" />
</Dropdown>
<OptIn name="tos" label="I agree" onClickAction={<OpenURL url="https://…/terms" />} />
```

### Composition

Choices and lists are composed from child elements rather than array props.
`Dropdown` / `RadioButtonsGroup` / `CheckboxGroup` / `ChipsSelector` take `<Option>`
children, `NavigationList` takes `<NavItem>` children, and `ImageCarousel` takes
`<CarouselImage>` children. `<Option>` and `<NavItem>` require a `title` prop.

```tsx
<RadioButtonsGroup name="color" label="Color">
  <Option id="red" title="Red" />
  <Option id="blue" title="Blue" />
</RadioButtonsGroup>

<NavigationList name="menu" onClickAction={<Next to="/done" />}>
  <NavItem id="a" title="Option A" description="First" />
  <NavItem id="b" title="Option B" />
</NavigationList>
```

`If` / `Switch` render components conditionally without an endpoint round-trip.
`If` renders its children when the condition is true; add an `<Else>` child for the
false branch. `Switch` composes `<Case value="…">` children and an optional
`<Default>`:

```tsx
<If condition="${form.tos}">
  <TextBody>Thanks!</TextBody>
  <Else><TextCaption>Please agree.</TextCaption></Else>
</If>

<Switch value="${form.color}">
  <Case value="red"><TextBody>You picked red</TextBody></Case>
  <Default><TextBody>Pick a color</TextBody></Default>
</Switch>
```

The `fixtures/all-components.tsx` flow exercises every component, and a test
asserts the compiled output contains all of them.

## Routing

Routes are compile-time aliases for screen ids. The compiler scans `<Next to>` and
`<Exchange next>` to build the `routing_model`:

```json
{ "START": ["PREFERENCES"], "PREFERENCES": ["CONFIRM"], "CONFIRM": [] }
```

If a link points at a route with no matching screen, **compilation fails** with a
route-scoped error naming the offending screen and the missing route.

## Validation & formal verification

Two layers run on every build and **fail the compile** on any issue:

1. **Semantic checks** (developer-readable, route-scoped errors): route existence,
   unique screen ids, unique field names per form (recursing through `If`/`Switch`),
   exactly one action per `Footer`, terminal/complete consistency, dead-end screens,
   terminal screens without `<Complete>`, inputs inside a `Form`, no unsupported
   components, no unserializable values, and a clean `JSON.stringify`/`parse`
   round-trip.
2. **Formal verification:** the compiled JSON is validated against a generated
   **JSON Schema** (`buildFlowJsonSchema()`) using **Ajv** — a validation engine
   independent of the builder. The schema and the normalizer are both generated from
   one component registry (`specs.ts`), so they cannot drift, and the schema is a
   portable artifact you can reuse (`whatsapp-flow schema`). It rejects unknown
   component/action types, stray keys (e.g. JSX artifacts), bad enum values, missing
   required properties, and wrong value types.

## Develop

```bash
pnpm install
pnpm -r build       # build the three packages
pnpm -r typecheck   # tsc --noEmit per package
pnpm test           # vitest (unit + compiler e2e + snapshots)
```

`fixtures/app` is a flows-app fixture; `fixtures/mixed-app` mixes a flow with
message templates; `examples/grocery-order` is a complete flows-app example.
