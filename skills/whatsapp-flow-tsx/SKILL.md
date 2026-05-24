---
name: whatsapp-flow-tsx
description: Author, compile, and push WhatsApp Flows written as TypeScript/TSX. Use whenever the user wants to write, build, create, scaffold, edit, compile, or deploy a WhatsApp/Meta Flow — multi-screen flows, screens, forms and inputs (text, dropdown, radio, checkbox, chips, date/calendar, photo/document pickers), navigation lists, image carousels, If/Switch UI, routing between screens, data-exchange screens, or embedding images — even if they don't say "TSX". Also for fixing flow build/validation errors and for `flows push` (syncing compiled flows to Meta as drafts, optionally publishing). Flows are single .tsx files in a flows/ app directory (with flows.config.ts); images come from the app's public/ dir. Prefer this over hand-writing raw Flow JSON. For lower-level Meta lifecycle on existing flows — listing, preview, deprecating, deleting, sending, migrating between WABAs, or status — use a Meta Graph API flow-CRUD skill; not for general WhatsApp messaging or message templates.
---

# WhatsApp Flow authoring (TSX → Flow JSON)

Author WhatsApp Flows as typed `.tsx` files and compile them to Meta Flow JSON.
**This is a compile-time authoring layer, not a runtime.** The `.tsx` runs once, at
build time, to emit an ordinary Flow JSON document. There is no React, no DOM, no
hooks, no device-side state — WhatsApp renders the compiled JSON natively. The TSX
is just a typed, validated way to *write* that JSON.

This skill covers the whole loop: write `.tsx`, compile, and **push** flows to Meta
as drafts (`flows push`, optionally `--publish`). Lower-level Meta lifecycle on
existing flows — preview, deprecate, delete, send, migrate, status — belongs to a
separate Meta Graph API flow-CRUD skill (referenced as **`whatsapp-flow-crud`**
below), which owns those Graph API operations and the WABA/phone-number ids.

## Where things live

- **A flows app** is a `flows/` directory, organized Next.js-style. `flows.config.ts`
  is the project config; **each top-level `.tsx` file is one flow** (e.g.
  `flows/woolworths-login.tsx`). `flows.lock.json` (committed) maps each flow to its
  Meta id per WABA.
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
function per screen. The **first screen export** (or one named `Index`/`Start`, or
`flow.start`) is the start screen at route `/`; others route to
`/<kebab-of-export-name>`. Link screens by route; the compiler infers the
`routing_model` from your `<Next>` / `<Exchange>` links.

`flows/flows.config.ts` — the project config ("next.config.ts" of flows):

```ts
import { defineFlowsApp } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.3",            // default Flow JSON version for every flow
  namePrefix: "acme_",       // file name → flow name (grocery.tsx → acme_grocery)
  categories: ["SIGN_IN"],   // default categories
  wabas: { prod: { id: "…" }, dev: { id: "…" } },
  defaultWaba: "dev",        // which WABA `flows push` targets
});
```

`flows/grocery.tsx` — one flow:

```tsx
import { defineFlow, Screen, Form, TextArea, TextBody, Footer, Next, Complete, field } from "whatsapp-flow-tsx";

export const flow = defineFlow({
  // name defaults to namePrefix + filename ("acme_grocery"); override here.
  categories: ["LEAD_GENERATION"],
  // version, categories, strict inherit the app; dataApiVersion, endpointUri, start are per-flow
});

export function Index() {                  // first export → start "/" → screen id START
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
pnpm flows push              # sync drafts to Meta (needs WHATSAPP_ACCESS_TOKEN)
pnpm flows push --publish    # sync + publish (goes live)
pnpm flows push --waba both  # target every configured WABA (default: defaultWaba)
```

`push` needs `WHATSAPP_ACCESS_TOKEN` in the environment (e.g. load `.env.local` with
`dotenvx run -f .env.local -- whatsapp-flow push`). It compiles every flow, then per
flow: **creates** a Meta draft if new (adopting a live flow by matching name on first
push), **replaces** the JSON if its content hash changed, or **skips** it if
unchanged — bumping `rev` in `flows.lock.json`. Publishing only happens with
`--publish`. `inspect` is a text outline, not a faithful render of WhatsApp's UI.

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
screen. By default warnings (dead-end screens, terminal screens without `<Complete>`)
are also errors; set `strict: false` in `flows.config.ts` (or a flow's `flow` config)
to downgrade them to console warnings.

## Handoff: lower-level lifecycle

`flows push` handles compile + create/update drafts (and `--publish`). For
everything else on flows already on Meta — **preview, deprecate, delete, send a
flow to a user, migrate between WABAs, list, or check status/validation** — use a
Meta Graph API flow-CRUD skill (the **`whatsapp-flow-crud`** skill), which owns those
Graph API operations and the dev/prod WABA + phone-number ids. Don't reimplement
those here.

## Sharp edges

- **Author in TSX, not raw JSON.** If you're tempted to hand-edit compiled JSON,
  change the `.tsx` and recompile instead — the JSON is a build artifact.
- **One flow per file.** Screens are PascalCase function exports; the first (or
  `Index`/`Start`, or `flow.start`) is the start at `/`. Other exports route to
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
