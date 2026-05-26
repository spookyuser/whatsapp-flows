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
  flows.config.ts                project config (the "next.config.ts" of flows)
  grocery.tsx                    one flow  ->  name "grocery"
  woolworths-login.tsx           one flow  ->  name "woolworths_login"
  flows.lock.json                committed; maps each flow to its Meta id per env
  whatsapp-flows.generated.ts    auto-written on push; typed ids for every env
```

`flows.config.ts`:

```ts
import { defineFlowsApp, fromCommand } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.3",                                    // default Flow JSON version
  wabas: {                                           // named deploy targets
    dev: { id: "2142644013223594" },
    prod: { id: "26870122239247230" },
  },
  defaultEnv: "dev",                                 // used when --env / WHATSAPP_ENV unset
  token: fromCommand("convex env get WHATSAPP_ACCESS_TOKEN"), // optional; see Push & deploy
});
```

Declare one or more **named environments** under `wabas`. Pick the target with
`--env <name>`, the `WHATSAPP_ENV` var, or `defaultEnv` (a lone env is auto-picked).
The committed `flows.lock.json` is **keyed by env name**, so it holds dev and prod
state side by side.

### A flow is a file

Each `.tsx` exports its config as `flow` plus one **PascalCase function per screen**.
The export **must** be named `Index` — that's the start screen at route `/`. Every
other export routes to `/<kebab-of-export-name>`. Link screens by route; the
compiler infers the `routing_model` from your links.

```tsx
// flows/grocery.tsx
import { defineFlow, Screen, Form, TextArea, TextBody, Footer, Next, Complete, field } from "whatsapp-flow-tsx";

export const flow = defineFlow({
  // name defaults to the filename ("grocery"); set `name` to override.
  categories: ["LEAD_GENERATION"],
  // version inherits the app; dataApiVersion + endpointUri are per-flow.
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
// flows/welcome.tsx  →  template "welcome"
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
to the filename, lowercased — set to override), and `allowCategoryChange` (default
`false`, so Meta must approve the category you chose rather than silently re-categorizing).
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
whatsapp-flow push                   # sync + publish to the current env's WABA
whatsapp-flow ids                    # print locked ids as JSON (push auto-writes the typed module)

whatsapp-flow schema  --out flow.schema.json        # emit the JSON Schema used for verification
```

`inspect` is a lightweight text preview (route map + transitions + per-screen
outline) — **not** a faithful render of WhatsApp's UI.

## Push & deploy

`push` targets one env (`--env`, `WHATSAPP_ENV`, or `defaultEnv`), compiles every
flow, then reconciles it against Meta and a committed **`flows.lock.json`** (keyed
by env name: `env → { wabaId, assets: { name → { id, rev, hash } } }`):

- **Change detection** — each compiled flow is hashed; an unchanged flow is **skipped**.
- **Create / adopt** — a flow with no lock entry is created on Meta; if a live flow
  already exists with the same name, it is **adopted by name** rather than duplicated.
- **Update** — a changed flow's JSON is re-uploaded.
- **Publish** — every touched flow is published (goes live) on every push. Iterate in
  app code with feature flags, not by holding back the publish step.
- **Versioning** — `rev` in the lockfile bumps on every change.
- **One env per push** — to deploy to dev and prod, run `push --env dev` then
  `push --env prod`. (A flow of the same name is a distinct Meta asset per WABA.)
- **Typed ids** — after a successful push, `whatsapp-flows.generated.ts` is rewritten
  next to `flows.config.ts`. It exports every env plus `flowId(name, env?)` /
  `templateId(name, env?)` helpers (env defaults to `WHATSAPP_ENV`), so app code does
  `flowId("woolworths_login")`. Override the path via `generatedIdsPath`.

**Templates** ride the same pipeline and lockfile. A template with no lock entry (and
no live template of the same name + language) is **created**, which submits it to Meta
for async review; a changed template is **edited** in place; an unchanged one is
**skipped**. The auto-publish behavior doesn't apply — templates go live through Meta
review — and the lockfile records each template's last known status (e.g. `PENDING`).
Template keys are scoped `tpl:<name>@<language>`.

`push` needs a Graph API **access token**. Set `token` in `flows.config.ts` — a
string, a JSON-friendly `{ command: "…" }`, the `fromCommand("…")` helper, or a
function `(ctx) => string | Promise<string>` — or omit it to fall back to the
`WHATSAPP_ACCESS_TOKEN` env var (e.g. `dotenvx run -f .env.local -- whatsapp-flow
push`). `fromCommand` is a shell-*out*, not a shell: it splits on whitespace with no
quoting or pipes. Start with `push --dry-run` to preview the plan.

Configuring a flow's `endpoint_uri` (for data-exchange flows) is **not** done by
`push`; set it via the Graph API / Flow Builder separately.

### Config in package.json, and walk-up discovery

Every command walks up from the cwd to find the flows app, so you can run it from a
subdirectory. The config can live in `flows.config.ts` **or** a `whatsappFlows` key
in `package.json` (handy when the token is the JSON-friendly `{ command }` form and
no `.ts` config is needed):

```jsonc
// package.json
{
  "whatsappFlows": {
    "wabas": { "dev": { "id": "2142…" }, "prod": { "id": "2687…" } },
    "defaultEnv": "dev",
    "token": { "command": "convex env get WHATSAPP_ACCESS_TOKEN" }
  }
}
```

`flows.config.ts` wins when both are present.

### Lockfile migration (v1 → v2)

A pre-existing `flows.lock.json` keyed by raw WABA id (v1) is rejected with an
upgrade hint. Migrate it by hand once: bump `version` to `2`, replace the top-level
`wabas` map with an `envs` map, and move each WABA's entries under the env name that
targets it (`wabaId` records which WABA the env points at). Drop any WABA that no
longer maps to an env.

```jsonc
// before — v1 (keyed by raw WABA id)
{
  "version": 1,
  "wabas": {
    "2142644013223594": { "woolworths_login": { "id": "443…", "rev": 3, "hash": "…", "kind": "flow" } },
    "26870122239247230": { "woolworths_login": { "id": "208…", "rev": 2, "hash": "…", "kind": "flow" } }
  }
}

// after — v2 (keyed by env name)
{
  "version": 2,
  "envs": {
    "dev":  { "wabaId": "2142644013223594",  "assets": { "woolworths_login": { "id": "443…", "rev": 3, "hash": "…", "kind": "flow" } } },
    "prod": { "wabaId": "26870122239247230", "assets": { "woolworths_login": { "id": "208…", "rev": 2, "hash": "…", "kind": "flow" } } }
  }
}
```

### tsconfig preset

Author projects can extend the shipped preset instead of hand-listing JSX options:

```jsonc
// flows/tsconfig.json
{ "extends": "whatsapp-flow-tsx/tsconfig" }
```

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
