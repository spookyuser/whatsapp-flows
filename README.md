# whatsapp-flows

Author **Meta WhatsApp Flows** as TypeScript/TSX files with a tiny, Next.js-style
file-based router, compile them to valid **Flow JSON**, and push them to Meta.

> **This is a compile-time authoring layer, not a runtime.** Your `.tsx` files are
> never executed inside WhatsApp. They run **once, at build time**, to produce an
> ordinary Flow JSON document that is uploaded to Meta. There is no React, no DOM,
> no hooks, and no client-side state on the device — WhatsApp renders the compiled
> JSON natively. The TSX is just a typed, ergonomic way to *write* that JSON.

## Why

Flow JSON is verbose and stringly-typed, and a multi-screen flow is essentially a
little state machine with a `routing_model`. This framework lets you write each
screen as a typed component, infers the routing model from your `<Next>` /
`<Exchange>` links, validates the whole thing, emits the JSON, and syncs it to Meta.

## Packages

| Package | Purpose |
| --- | --- |
| `whatsapp-flow-core` | Flow JSON types, component registry, generated JSON Schema + Ajv verifier, reference helpers, normalizer, validator. Usable without TSX. |
| `whatsapp-flow-tsx` | Custom JSX runtime + authoring components (`Screen`, `Form`, `TextArea`, `Next`, …) + `defineFlow` / `defineFlowsApp`. No React. |
| `whatsapp-flow-cli` | Flow discovery, route→screen-id mapping, routing model, validation, image encoding, the Meta push pipeline, and the `whatsapp-flow` CLI. |

## A flows app

The primary model is a **flows app**: a directory with a `flows.config.ts` and one
`.tsx` file per flow. A single `whatsapp-flow push` compiles and syncs them all.

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
  // tokenEnv: "WHATSAPP_ACCESS_TOKEN" (default), strict …
});
```

### A flow is a file

Each `.tsx` exports its config as `flow` plus one **PascalCase function per screen**.
The first screen export (or one named `Index`/`Start`, or `flow.start`) is the start
screen at route `/`; every other export routes to `/<kebab-of-export-name>`. Link
screens by route; the compiler infers the `routing_model` from your links.

```tsx
// flows/grocery.tsx
import { defineFlow, Screen, Form, TextArea, TextBody, Footer, Next, Complete, field } from "whatsapp-flow-tsx";

export const flow = defineFlow({
  // name defaults to namePrefix + filename ("acme_grocery"); override here.
  categories: ["LEAD_GENERATION"],
  // version, categories, strict inherit the app; dataApiVersion, endpointUri, start are per-flow
});

export function Index() {                    // first export → start "/" → screen id START
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

### Single flow (folder model)

A standalone flow is also supported: a folder with a `flow.config.ts` and a
`screens/` directory, where each `screens/*.tsx` default-exports one screen and the
file name is the route (`index.tsx` → `/`). `whatsapp-flow build flows/grocery`
compiles just that folder. See [`examples/grocery-order`](examples/grocery-order) for
a complete folder-model flow and its compiled `flow.json`.

To make the JSX type-check in your editor, point TypeScript at the custom runtime:

```json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "whatsapp-flow-tsx" } }
```

(Compilation itself uses esbuild and doesn't depend on this — it's for editor types.)

## CLI

```bash
# Flows app (run from the app root; no path needed — acts on every flow)
whatsapp-flow check                  # validate every flow
whatsapp-flow inspect                # outline every flow: routes, ids, transitions
whatsapp-flow build                  # compile all → flows/.build/<name>.json
whatsapp-flow push --dry-run         # show what would sync to Meta (create/update/skip)
whatsapp-flow push                   # sync drafts to Meta
whatsapp-flow push --publish         # sync + publish (goes live)
whatsapp-flow push --waba both       # target every configured WABA (default: defaultWaba)

# Single flow (folder model)
whatsapp-flow build   flows/grocery                 # compile and write flow.json
whatsapp-flow build   flows/grocery --out out.json  # …to a custom path
whatsapp-flow check   flows/grocery                 # validate, write nothing
whatsapp-flow inspect flows/grocery                 # routes, ids, transitions, screen outline

whatsapp-flow schema  --out flow.schema.json        # emit the JSON Schema used for verification
```

`build`/`check`/`inspect` auto-detect: given a directory with `flows.config.ts` (or
run with no path in one) they act on the whole app; given a flow folder they act on
that one flow. `inspect` is a lightweight text preview (route map + transitions +
per-screen outline) — **not** a faithful render of WhatsApp's UI.

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

`push` needs a Meta access token in the environment — `WHATSAPP_ACCESS_TOKEN` by
default, or the env var named by `tokenEnv` in `flows.config.ts`. Load it however you
like, e.g. `dotenvx run -f .env.local -- whatsapp-flow push`. Start with
`push --dry-run` to preview the plan.

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

Every component in Meta's current Flow JSON catalog is supported:

- **Structure:** `Screen`, `SingleColumnLayout`/`Layout`, `Form`, `Footer`, `If`, `Switch`
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
`<CarouselImage>` children. An `<Option>`/`<NavItem>` title may be written as text
children instead of a `title` prop:

```tsx
<RadioButtonsGroup name="color" label="Color">
  <Option id="red">Red</Option>
  <Option id="blue">Blue</Option>
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

The `fixtures/all-components` flow exercises every component, and a test asserts the
compiled output contains all of them.

## Routing

Routes are compile-time aliases for screen ids. The compiler scans `<Next to>` and
`<Exchange next>` to build the `routing_model`:

```json
{ "START": ["PREFERENCES"], "PREFERENCES": ["CONFIRM"], "CONFIRM": [] }
```

If a link points at a route with no matching screen, **compilation fails** with a
route-scoped error naming the offending screen and the missing route.

## Validation & formal verification

Two layers run on every build:

1. **Semantic checks** (developer-readable, route-scoped errors): route existence,
   unique screen ids, unique field names per form (recursing through `If`/`Switch`),
   exactly one action per `Footer`, terminal/complete consistency, inputs inside a
   `Form`, no unsupported components, no unserializable values, and a clean
   `JSON.stringify`/`parse` round-trip.
2. **Formal verification:** the compiled JSON is validated against a generated
   **JSON Schema** (`buildFlowJsonSchema()`) using **Ajv** — a validation engine
   independent of the builder. The schema and the normalizer are both generated from
   one component registry (`specs.ts`), so they cannot drift, and the schema is a
   portable artifact you can reuse (`whatsapp-flow schema`). It rejects unknown
   component/action types, stray keys (e.g. JSX artifacts), bad enum values, missing
   required properties, and wrong value types.

Set `strict: false` in `flows.config.ts` (or a flow's `flow` config) to downgrade
warnings (dead-end screens, terminal screens without `<Complete>`) from errors to
console warnings.

## Develop

```bash
pnpm install
pnpm -r build       # build the three packages
pnpm -r typecheck   # tsc --noEmit per package
pnpm test           # vitest (unit + compiler e2e + snapshots)
```

`fixtures/app` is a single-file flows-app fixture; `examples/grocery-order` is a
complete folder-model flow with its compiled `flow.json`.

## Status & scope

Focused on **correctness**: the full component catalog, compiling to valid Flow JSON
(default version `7.3`), with formal JSON-Schema verification — plus a `push`
pipeline that syncs drafts to Meta (optionally publishing) with lockfile-based change
detection. Component shapes follow Meta's official Flow JSON / Components docs;
confirm the exact `version` value against Meta's current docs before shipping a
production flow.

The `whatsapp-flow-tsx` authoring skill lives in [`skills/`](skills/whatsapp-flow-tsx).
Lower-level Meta lifecycle on existing flows (preview, deprecate, delete, send,
migrate, status) is out of scope here — handle it via the Graph API directly.
