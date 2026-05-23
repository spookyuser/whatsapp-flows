# whatsapp-flows

Author **Meta WhatsApp Flows** as TypeScript/TSX files with a tiny, Next.js-style
file-based router, and compile them to valid **Flow JSON**.

> **This is a compile-time authoring layer, not a runtime.** Your `.tsx` files are
> never executed inside WhatsApp. They run **once, at build time**, to produce an
> ordinary Flow JSON document that you upload to Meta. There is no React, no DOM,
> no hooks, and no client-side state on the device — WhatsApp renders the compiled
> JSON natively. The TSX is just a typed, ergonomic way to *write* that JSON.

## Why

Flow JSON is verbose and stringly-typed, and a multi-screen flow is essentially a
little state machine with a `routing_model`. This framework lets you write each
screen as a typed component, infers the routing model from your `<Next>` /
`<Exchange>` links, validates the whole thing, and emits the JSON.

## Packages

| Package | Purpose |
| --- | --- |
| `whatsapp-flow-core` | Flow JSON types, component registry, generated JSON Schema + Ajv verifier, reference helpers, normalizer, validator. Usable without TSX. |
| `whatsapp-flow-tsx` | Custom JSX runtime + authoring components (`Screen`, `Form`, `TextArea`, `Next`, …). No React. |
| `whatsapp-flow-cli` | File discovery, route→screen-id mapping, routing model, validation, and the `whatsapp-flow` CLI. |

## A flow is a folder

```
flows/grocery/
  flow.config.ts
  screens/
    index.tsx        ->  route "/"             ->  screen id "START"
    preferences.tsx  ->  route "/preferences"  ->  screen id "PREFERENCES"
    confirm.tsx      ->  route "/confirm"       ->  screen id "CONFIRM"
```

`flow.config.ts`:

```ts
import { defineFlow } from "whatsapp-flow-tsx";

export default defineFlow({
  name: "grocery_order",
  version: "7.2",
  start: "/",
  output: "flow.json",
});
```

A screen — `screens/index.tsx`:

```tsx
import { Screen, Form, TextArea, Footer, Next, field } from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen title="Start your order">
      <Form name="form">
        <TextArea name="shopping_list" label="What should we buy?" required />
        <Footer>
          <Next to="/preferences" data={{ shopping_list: field("shopping_list") }}>
            Continue
          </Next>
        </Footer>
      </Form>
    </Screen>
  );
}
```

To make the JSX type-check, point TypeScript at the custom runtime in the flow
project's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "whatsapp-flow-tsx"
  }
}
```

## CLI

```bash
whatsapp-flow build   flows/grocery                 # compile and write flow.json
whatsapp-flow build   flows/grocery --out out.json  # …to a custom path
whatsapp-flow check   flows/grocery                 # validate, write nothing
whatsapp-flow inspect flows/grocery                 # print routes, ids, transitions, screen outline
whatsapp-flow schema  --out flow.schema.json        # emit the JSON Schema used for verification
```

`inspect` is a lightweight, text-based preview (route map + transitions + a
per-screen component outline). It is **not** a faithful render of WhatsApp's UI.

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

The `examples/`/`fixtures/all-components` flow exercises every component, and a test
asserts the compiled output contains all of them.

## Routing

Routes are compile-time aliases for screen ids. The compiler scans `<Next to>` and
`<Exchange next>` to build the `routing_model`:

```json
{ "START": ["PREFERENCES"], "PREFERENCES": ["CONFIRM"], "CONFIRM": [] }
```

If a link points at a route with no matching screen file, **compilation fails**:

```
Screen "/preferences" has a <Next to="/confirm">, but no screen exists at "screens/confirm.tsx".
```

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

Set `strict: false` in `flow.config.ts` to downgrade warnings (dead-end screens,
terminal screens without `<Complete>`) from errors to console warnings.

## Develop

```bash
pnpm install
pnpm -r build       # build the three packages
pnpm -r typecheck   # tsc --noEmit per package
pnpm test           # vitest (unit + compiler e2e + snapshots)
```

See `examples/grocery-order` for a complete flow and `examples/grocery-order/flow.json`
for its compiled output.

## Status & scope

Focused on **correctness**: the full component catalog, compiling to valid Flow JSON
(default version `7.3`), with formal JSON-Schema verification. Uploading/publishing to
Meta is intentionally out of scope — verification is local. Component shapes follow
Meta's official Flow JSON / Components docs; confirm the exact `version` value against
Meta's current docs before shipping a production flow.
