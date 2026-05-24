# TSX authoring reference

Everything you need to write flow `.tsx` files for the `whatsapp-flow-tsx`
framework. All components/actions/helpers are imported from `whatsapp-flow-tsx`.
Compile with `pnpm flows check` / `pnpm flows build` (see SKILL.md). Prop names are camelCase in TSX
and are normalized to Meta's kebab-case keys at compile time (`scaleType` →
`scale-type`, `onClickAction` → `on-click-action`).

## Contents

- [Mental model](#mental-model)
- [Reference helpers (dynamic values)](#reference-helpers-dynamic-values)
- [Actions](#actions)
- [Structure components](#structure-components)
- [Text & display](#text--display)
- [Inputs](#inputs)
- [Choices & lists (children, not arrays)](#choices--lists-children-not-arrays)
- [Conditionals: If / Switch](#conditionals-if--switch)
- [Multi-screen data flow](#multi-screen-data-flow)
- [Data-exchange (endpoint) flows](#data-exchange-endpoint-flows)
- [Common validation errors](#common-validation-errors)

## Mental model

- One flow per `.tsx` file: `export const flow = defineFlow({…})` plus one PascalCase
  function export per screen, each returning exactly one `<Screen>`. The export
  named `Index` is required and is the start screen at `/`.
- A `<Screen>` usually contains a single `<Form name="form">` wrapping inputs and a
  `<Footer>`. Display-only components (text, image) can sit directly in the screen.
- A `<Footer>` holds **exactly one** action (`<Next>`, `<Complete>`, `<Exchange>`,
  `<OpenURL>`, `<UpdateData>`).
- Navigation is by **route** (`to="/confirm"`); a screen export named `Confirm`
  routes to `/confirm`. The compiler builds the routing model from your links.
- Text display components accept their text as either the `text` prop *or* as JSX
  children — `<TextBody>Hi</TextBody>` equals `<TextBody text="Hi" />`. Structural
  items (`<Option>`, `<NavItem>`) take `title` as a required prop.

## Reference helpers (dynamic values)

Bindings into Meta's `${…}` expression language. Import and call them; never write
the raw string.

| Helper | Compiles to |
| --- | --- |
| `field("postcode")` | `${form.postcode}` — input on the current screen's form |
| `data("eta")` | `${data.eta}` — a scalar this screen received (forwarded or endpoint-returned) |
| `screenData("/confirm", "total")` | `${screen.CONFIRM.data.total}` — value from another screen |

For component props that take a condition/visibility expression (`visible`,
`enabled`, `If condition`, `Switch value`), pass the expression string directly,
e.g. `visible="${form.tos}"`. For concatenation/comparison Meta uses backticked
nested expressions, e.g. `` "`${form.age} >= 18`" `` — verify against Meta docs.

## Actions

| Component | Compiles to | Use |
| --- | --- | --- |
| `<Next to="/x" data={…}>` | `navigate` | go to another screen, passing `data` forward |
| `<Complete data={…}>` | `complete` | terminate the flow (terminal screen) and return data |
| `<Exchange action="op" next="/x" data={…}>` | `data_exchange` | call the flow endpoint, then route to `next` |
| `<OpenURL url="https://…">` | `open_url` | open an external link |
| `<UpdateData data={…}>` | `update_data` | merge values into screen data on-device, no round-trip |

All take an optional `label` (or text children) used as the button/caption text.
`data` values are usually refs (`field(…)`, `data(…)`).

```tsx
<Footer>
  <Next to="/preferences" data={{ list: field("shopping_list") }}>Continue</Next>
</Footer>

<Footer>
  <Complete data={{ list: data("list") }}>Submit order</Complete>
</Footer>
```

Action-valued props take an action **element** directly (note the JSX, not a function):

```tsx
<Dropdown name="size" label="Size"
  onSelectAction={<UpdateData data={{ chosen: field("size") }} />}>
  <Option id="s" title="Small" />
  <Option id="m" title="Medium" />
</Dropdown>
<OptIn name="tos" label="I agree" onClickAction={<OpenURL url="https://example.com/terms" />} />
<EmbeddedLink onClickAction={<OpenURL url="https://example.com/info" />}>Learn more</EmbeddedLink>
```

## Structure components

| Component | Key props | Notes |
| --- | --- | --- |
| `Screen` | `title?`, `terminal?`, `success?`, `data?` | One per export. `data` is the screen's input schema (see [Multi-screen](#multi-screen-data-flow)). `terminal` is usually inferred from `<Complete>`. The screen's layout (Meta's `SingleColumnLayout`) is implicit — write children directly. |
| `Form` | `name?` (default `"form"`) | Wraps all inputs on a screen. Field `name`s must be unique within it. |
| `Footer` | `label?`, `leftCaption?`, `centerCaption?`, `rightCaption?`, `enabled?` | Holds exactly one action child. |

## Text & display

| Component | Key props |
| --- | --- |
| `TextHeading`, `TextSubheading` | `text?` / children, `visible?` |
| `TextBody`, `TextCaption` | `text?` (string or string[]), `markdown?`, `fontWeight?` (`bold`/`italic`/`bold_italic`/`normal`), `strikethrough?`, `visible?` |
| `RichText` | `text?` (string or string[] of markdown), `visible?` |
| `Image` | `src` (a local path or URL — auto-encoded to base64 at build time; see [Images](#images)), `width?`, `height?`, `scaleType?` (`contain`/`cover`), `aspectRatio?`, `altText?`, `visible?` |
| `ImageCarousel` | `scaleType?`, `aspectRatio?`, `visible?`; takes `<CarouselImage>` children |
| `CarouselImage` | `src` (path or URL, auto-encoded), `altText?` |
| `EmbeddedLink` | `text?` / children, `onClickAction` (required action), `visible?` |

```tsx
<TextHeading>Weekly specials</TextHeading>
<TextBody markdown>Save on **braai packs** this week.</TextBody>
<Image src="../public/braai.png" altText="Braai pack" scaleType="cover" />  {/* path → base64 at build */}
<ImageCarousel scaleType="cover">
  <CarouselImage src="../public/pack-1.png" altText="Pack 1" />
  <CarouselImage src="https://cdn.example.com/pack-2.png" altText="Pack 2" />
</ImageCarousel>
```

## Inputs

All inputs require a `name` and `label` and must live inside a `<Form>`. They are
optional unless you set `required`. They share `enabled?` and `visible?`; most also
take `required?` and `initValue?`. `errorMessage?` exists on the text/selection
inputs (`TextInput`, `TextArea`, `Dropdown`, `RadioButtonsGroup`, `CheckboxGroup`,
`PhotoPicker`, `DocumentPicker`) but not on `ChipsSelector`, `OptIn`, `DatePicker`,
or `CalendarPicker`. When in doubt, run `check` — it names any prop the schema rejects.

| Component | Distinctive props |
| --- | --- |
| `TextInput` | `inputType?` (`text`/`number`/`email`/`password`/`passcode`/`phone`), `pattern?`, `minChars?`, `maxChars?`, `helperText?` |
| `TextArea` | `maxLength?`, `helperText?` |
| `Dropdown` | `onSelectAction?`, `onUnselectAction?`; `<Option>` children |
| `RadioButtonsGroup` | `description?`, `mediaSize?` (`regular`/`large`), `onSelectAction?`; `<Option>` children |
| `CheckboxGroup` | `minSelectedItems?`, `maxSelectedItems?`, `initValue?: string[]`, `mediaSize?`; `<Option>` children |
| `ChipsSelector` | `minSelectedItems?`, `maxSelectedItems?`, `initValue?: string[]`; `<Option>` children |
| `OptIn` | `initValue?: boolean`, `onClickAction?` |
| `DatePicker` | `minDate?`, `maxDate?`, `unavailableDates?: string[]`, `helperText?`, `onSelectAction?` |
| `CalendarPicker` | `mode?` (`single`/`range`), `minDate?`, `maxDate?`, `unavailableDates?`, `includeDays?`, `onSelectAction?`; `label` may be a `{start,end}` map |
| `PhotoPicker` | `photoSource?` (`camera_gallery`/`camera`/`gallery`), `maxFileSizeKb?`, `minUploadedPhotos?`, `maxUploadedPhotos?`, `description?` |
| `DocumentPicker` | `allowedMimeTypes?: string[]`, `maxFileSizeKb?`, `minUploadedDocuments?`, `maxUploadedDocuments?`, `description?` |

## Choices & lists (children, not arrays)

Compose options/items as child elements.

```tsx
<RadioButtonsGroup name="color" label="Color">
  <Option id="red" title="Red" />
  <Option id="blue" title="Blue" />
</RadioButtonsGroup>

<CheckboxGroup name="toppings" label="Toppings" minSelectedItems={1} maxSelectedItems={3}>
  <Option id="cheese" title="Cheese" description="Extra" />
  <Option id="olives" title="Olives" />
</CheckboxGroup>
```

`<Option>` props: `id?`, `title` (required), `description?`, `metadata?`, `enabled?`,
`image?` (path or URL, auto-encoded), `altText?`.

`<NavigationList>` takes `<NavItem>` children and an optional default
`onClickAction` for items without their own:

```tsx
<NavigationList name="menu" onClickAction={<Next to="/done" />}>
  <NavItem id="a" title="Option A" description="First" />
  <NavItem id="b" title="Option B" onClickAction={<Next to="/b" />} />
</NavigationList>
```

`<NavItem>` props: `id?`, `title` (required), `description?`, `metadata?`, `image?`
(path or URL, auto-encoded), `badge?`, `tags?: string[]`, `onClickAction?`.

## Conditionals: If / Switch

Client-side conditional rendering — no endpoint needed. The condition/value is a
Meta expression string (often built from `${form.…}`).

```tsx
<If condition="${form.tos}">
  <TextBody>Thanks for agreeing.</TextBody>
  <Else>
    <TextCaption>Please agree to continue.</TextCaption>
  </Else>
</If>

<Switch value="${form.color}">
  <Case value="red"><TextBody>You picked red</TextBody></Case>
  <Case value="blue"><TextBody>You picked blue</TextBody></Case>
  <Default><TextBody>Pick a color</TextBody></Default>
</Switch>
```

Field-name uniqueness is checked *through* `If`/`Switch` branches, so don't reuse an
input `name` across branches of the same form.

## Multi-screen data flow

To use a value on a later screen, pass it forward in the action's `data`, and
declare it in the destination `<Screen data={…}>` schema. Each declared field is
`{ type, __example__ }` — this is **Meta's own format** for a screen's dynamic-data
schema. It is emitted into the compiled JSON as-is: the `__example__` value stays in
`flow.json` (it documents the field's shape and seeds the inspector preview). It is
**not** stripped, and Meta expects it there, so don't be surprised to see it in the
output.

One file, two screen exports — `Index` forwards `shopping_list` to `Confirm`:

```tsx
import { defineFlow, Screen, Form, TextArea, TextBody, Footer, Next, Complete, field, data } from "whatsapp-flow-tsx";

export const flow = defineFlow({ categories: ["LEAD_GENERATION"] });

export function Index() {                          // start "/" → START
  return (
    <Screen title="Start your order">
      <Form name="form">
        <TextArea name="shopping_list" label="What should we buy?" required />
        <Footer>
          <Next to="/confirm" data={{ shopping_list: field("shopping_list") }}>Review</Next>
        </Footer>
      </Form>
    </Screen>
  );
}

export function Confirm() {                         // "/confirm" → CONFIRM
  return (
    <Screen
      title="Confirm your order"
      data={{ shopping_list: { type: "string", __example__: "Milk, eggs" } }}
    >
      <Form name="form">
        <TextBody>Please review before submitting.</TextBody>
        <Footer>
          <Complete data={{ shopping_list: data("shopping_list") }}>Submit</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}
```

## Data-exchange (endpoint) flows

Only when the flow needs **live data** from a server (look up slots, prices, etc.).
Set `dataApiVersion` and `endpointUri` in the flow's `defineFlow({…})` config
(they're per-flow, not app-level), and use `<Exchange>`.

```ts
export const flow = defineFlow({
  categories: ["APPOINTMENT_BOOKING"],
  dataApiVersion: "3.0",
  endpointUri: "https://api.example.com/flow",
});
```

`<Exchange action="lookupSlots" next="/slots" data={{ postcode: field("postcode") }}>`
sends the payload (with `action` folded in) to the endpoint and routes to `/slots`,
which declares the returned fields in its `<Screen data={…}>` schema. The endpoint's
own responses must include `"version": "3.0"` — but that's endpoint/runtime
territory, not part of authoring here.

Note: only `data_api_version` is emitted into `flow.json`. `endpointUri` is **not**
in the compiled JSON and `flows push` does **not** configure it — it's an
asset-level setting (Meta's `endpoint_uri`/Builder) applied separately via the Graph
API, so don't be alarmed when you don't see the URL in the output.

**Important limitation — choice options are static, not endpoint-driven.** This
framework does **not** let you bind a `Dropdown`/`RadioButtonsGroup`/`CheckboxGroup`/
`ChipsSelector`'s option list to a returned array like `${data.slots}`: options come
only from static `<Option>` children (the compiler requires a non-empty literal list
and rejects a ref there, and there is no `dataSource` prop). So you cannot render a
genuinely dynamic list of endpoint-returned choices. What you *can* do with returned
`data(...)` values: use them in `text`/`TextBody`, in `visible`/`enabled`
expressions, as an input's `initValue`, or in an action's `data` payload. For a
choice screen fed by an endpoint, author the realistic options as static `<Option>`s
(this is exactly what the framework's own `dynamic-data-exchange` fixture does). If a
flow truly needs a variable-length endpoint-driven list, that's a framework gap to
raise — don't try to force it in TSX.

## Common validation errors

`build`/`check` fail with route-scoped messages. Typical fixes:

| Message gist | Fix |
| --- | --- |
| `<Next to="/x">` but no screen exists for route `/x` | Add a screen export that routes to `/x`, or fix the route. |
| Duplicate screen id / duplicate field name in form | Rename the screen export or the input `name` (unique per form, across If/Switch). |
| `Footer` must contain exactly one action | Put a single `<Next>`/`<Complete>`/… in the `Footer`. |
| Input outside a `Form` | Wrap inputs in `<Form>`. |
| Unsupported component / unknown prop / bad enum | Use a component/prop/value from this reference. |
| Terminal screen without `<Complete>` / dead-end screen | Add a `<Complete>`, or wire an outgoing `<Next>` / `<Exchange>`. |

Re-run `check` after each fix until it reports `✓ N screen(s) valid`.
