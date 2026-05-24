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
  - [Routing model is static, acyclic, and must reach a terminal](#routing-model-is-static-acyclic-and-must-reach-a-terminal)
  - [Pattern: endpoint-driven retry without static loops](#pattern-endpoint-driven-retry-without-static-loops)
  - [Limitations to know about](#limitations-to-know-about)
- [Common validation errors](#common-validation-errors)
  - [Local (check/build/push)](#local-checkbuildpush--route-scoped-before-talking-to-meta)
  - [Meta-side (publish)](#meta-side-publish--surface-only-at-flows-push-time)

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

Only when the flow needs **live data** from a server (validate credentials, look
up slots, prices). Set `dataApiVersion` and `endpointUri` in the flow's
`defineFlow({…})` config (they're per-flow, not app-level), and use `<Exchange>`.

```ts
export const flow = defineFlow({
  categories: ["APPOINTMENT_BOOKING"],
  dataApiVersion: "3.0",
  endpointUri: "https://api.example.com/flow",
});
```

`<Exchange action="lookupSlots" next="/slots" data={{ postcode: field("postcode") }}>`
sends the payload (with `action` folded in) to the endpoint, and the endpoint's
response decides what screen to render next. The endpoint must be implemented
separately — see [references/endpoint.md](endpoint.md) for the wire protocol
(encryption, request/response shapes, provisioning prerequisites).

Note: only `data_api_version` is emitted into `flow.json`. `endpointUri` is **not**
in the compiled JSON and `flows push` does **not** configure it — it's an
asset-level setting (Meta's `endpoint_uri`/Builder) applied separately via the Graph
API. **A flow can't publish until both `endpoint_uri` is set on the asset and the
phone number's encryption public key is uploaded and signed.** Provision those once,
before the first `flows push`, or publish fails with Meta error 139002 / subcode
4233024 (missing endpoint_uri) or 4233012 (missing signed key).

### Routing model is static, acyclic, and must reach a terminal

The routing model Meta validates at publish time is the **static** graph built
from your `<Next>` and `<Exchange next>` props. It must be acyclic and every
path must reach a screen marked terminal (one with `<Complete>` / `success`).
This is true *even for endpoint-driven flows where the server decides where to
navigate at runtime* — the static graph still has to look complete on paper.

The framework's local `check` does **not** catch these — they only surface when
Meta validates at publish. Watch for:

- **Self-loops:** `<Exchange next="/retry">` inside a screen exported as `Retry`
  creates `RETRY → RETRY` and Meta rejects with `INVALID_ROUTING_MODEL` ("Loop
  detected in the routing model for screens: [RETRY]").
- **Missing terminal:** every static path must reach a `<Complete>`. If your
  whole flow is `<Exchange>`-driven, you still need at least one screen with
  `<Complete>` reachable via the static graph (`MISSING_TERMINAL_SCREEN`).

The right pattern for retry / error UX is **not** to add self-loops or branching
retry screens. Use the endpoint to navigate back to the input screen at runtime,
which is invisible to the static validator.

### Pattern: endpoint-driven retry without static loops

The endpoint can return *any* screen at runtime, including the current one or
Meta's reserved screens. Two facilities make retry UX easy:

- **`SUCCESS` (reserved terminal screen):** if the endpoint responds with
  `{ screen: "SUCCESS", data: { extension_message_response: { params: {...} } } }`,
  Meta closes the flow with its built-in "Done" UI and delivers `params` to the
  business via the `nfm_reply` webhook. You don't declare `SUCCESS` anywhere —
  it always works.
- **`error_message` (magic data field):** if the endpoint responds with
  `{ screen: "START", data: { error_message: "…" } }`, Meta re-renders that
  screen and surfaces `error_message` as an inline error. You don't declare
  `error_message` in the screen's `data` schema — it's universally accepted.
  The `screen` value must be the **compiled screen id** — `Index` exports to
  id `START`, not `"INDEX"`. Sending a screen id that doesn't exist in the
  flow makes Meta drop the response and show the user a generic "something
  went wrong" with **no log line on either side**, so this is silent and
  expensive to debug. Match the casing exactly to what `flows build` emits.

So the canonical "form with server-side validation and retry" shape is two
screens — the form, plus a placeholder `<Complete>` that exists only so the
static graph terminates — and the endpoint chooses `SUCCESS` or
`START + error_message` at runtime:

```tsx
export function Index() {
  return (
    <Screen title="Sign in">
      <Form>
        <TextInput name="email" label="Email" inputType="email" required />
        <TextInput name="password" label="Password" inputType="password" required />
        <Footer>
          <Exchange action="login" next="/done"
            data={{ email: field("email"), password: field("password") }}>
            Continue
          </Exchange>
        </Footer>
      </Form>
    </Screen>
  );
}

// Static terminal required by Meta's validator. Never rendered at runtime —
// the endpoint returns SUCCESS on success (auto-closes the flow) or
// re-navigates to START with `error_message` on failure.
export function Done() {
  return (
    <Screen title="Signed in" success>
      <Form>
        <TextBody>You're signed in.</TextBody>
        <Footer><Complete>Done</Complete></Footer>
      </Form>
    </Screen>
  );
}
```

### Limitations to know about

- **`initValue` is rejected on `TextInput`.** Meta accepts `init-value` on
  `RadioButtonsGroup`, `CheckboxGroup`, `ChipsSelector`, `OptIn`, etc., but
  rejects it on `TextInput` (and `TextArea`) at publish time with
  `INVALID_PROPERTY_KEY`. The framework's `check` does not catch this — it
  surfaces as a Meta-side validation error. There is no working alternative
  in current Flow JSON: a text input cannot be pre-filled by the flow itself.
  Pass the value via `flow_action_payload` on send if you must (and then
  *only* into a screen-data field used in text, not into an input).
- **Choice options are static, not endpoint-driven.** You cannot bind a
  `Dropdown`/`RadioButtonsGroup`/`CheckboxGroup`/`ChipsSelector`'s option list
  to a returned array like `${data.slots}` — options come only from static
  `<Option>` children. What you *can* do with returned `data(...)` values: use
  them in `text`/`TextBody`, in `visible`/`enabled` expressions, on inputs
  that accept `initValue` (above), or in an action's `data` payload. For a
  choice screen fed by an endpoint, author realistic options as static
  `<Option>`s (the framework's own `dynamic-data-exchange` fixture does
  exactly this).

## Common validation errors

### Local (`check`/`build`/`push`) — route-scoped, before talking to Meta

| Message gist | Fix |
| --- | --- |
| `<Next to="/x">` but no screen exists for route `/x` | Add a screen export that routes to `/x`, or fix the route. |
| Duplicate screen id / duplicate field name in form | Rename the screen export or the input `name` (unique per form, across If/Switch). |
| `Footer` must contain exactly one action | Put a single `<Next>`/`<Complete>`/… in the `Footer`. |
| Input outside a `Form` | Wrap inputs in `<Form>`. |
| Unsupported component / unknown prop / bad enum | Use a component/prop/value from this reference. |
| Terminal screen without `<Complete>` / dead-end screen | Add a `<Complete>`, or wire an outgoing `<Next>` / `<Exchange>`. |

Re-run `check` after each fix until it reports `✓ N screen(s) valid`.

### Meta-side (publish) — surface only at `flows push` time

`check` passes but `flows push` fails. Read the message in the error and, for
detail, query Meta directly:

```bash
curl -sS "https://graph.facebook.com/v25.0/<FLOW_ID>?fields=validation_errors,status,health_status,endpoint_uri" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
```

| Code / message | Cause | Fix |
| --- | --- | --- |
| 139002 / 4233012 "Missing flows signed public key" | The phone number's encryption public key isn't uploaded (or its `business_public_key_signature_status` isn't `VALID`). | Upload via `POST /{PHONE_NUMBER_ID}/whatsapp_business_encryption` (see [endpoint.md](endpoint.md)) **before** the first publish of any data-exchange flow on that number. |
| 139002 / 4233024 "Publishing without specifying 'endpoint_uri' is forbidden" | `endpoint_uri` not set on the asset. `defineFlow({ endpointUri })` is local-only — it doesn't propagate. | `POST /{FLOW_ID}` with form field `endpoint_uri=<url>`. One-time per flow per WABA. |
| 139002 / 4233014 "Endpoint not available" | Meta pinged your endpoint during publish and didn't get a valid encrypted `{data:{status:"active"}}` back. | Deploy your endpoint first. Smoke-test by sending a properly-encrypted ping yourself (script in [endpoint.md](endpoint.md)); the public response should decrypt to `{"data":{"status":"active"}}`. |
| `INVALID_ROUTING_MODEL` "Loop detected" | Static routing graph has a cycle (e.g. an `<Exchange next="/x">` inside the `X` screen). | Reshape: don't have the static graph loop. Have the endpoint re-navigate at runtime instead (see "Pattern: endpoint-driven retry" above). |
| `MISSING_TERMINAL_SCREEN` | No screen reachable in the static graph has `<Complete>`. | Add a terminal screen with `<Complete>` even if the endpoint is expected to terminate via `SUCCESS` at runtime. |
| `INVALID_PROPERTY_KEY` "Property 'init-value' is not allowed in 'TextInput'" | TextInput / TextArea reject `init-value` in current Flow JSON versions. | Remove the prop. There is no working alternative for these inputs. |
