---
name: whatsapp-flows-migration
description: Migrate (upgrade) an existing whatsapp-flows project to the current single-file, named-environment version. Use when an older project fails to build or push after upgrading whatsapp-flow-tsx / whatsapp-flow-cli — e.g. it still has a `flow.config.ts` + `screens/` folder per flow, uses `export default function` screens or a `start`/`output` flow field, sets `namePrefix`, configures a single `waba`/`defaultWaba`/`tokenEnv`, hits a "lockfile version 1 is no longer supported" / WABA-keyed `flows.lock.json` rejection, or uses removed components (`SingleColumnLayout`/`Layout`) or text-child `<Option>`/`<NavItem>`. Gives concrete before/after examples for each breaking change. To author new flows or templates from scratch (not migrate), use the companion `whatsapp-flow-tsx` / `whatsapp-template-tsx` skills instead.
---

# Migrating a whatsapp-flows project to the current version

The framework was reshaped from a **folder-per-flow, single-WABA** model into a
**single-file-per-flow, named-environment** model. An old project keeps building its
flows but trips over the breaking changes below. This skill is a checklist of those
changes with **before → after** examples; apply the ones your project hits, then run
`whatsapp-flow check` (`pnpm flows check`) until it's clean.

For authoring details of the *new* shapes, see the companion **`whatsapp-flow-tsx`**
(flows) and **`whatsapp-template-tsx`** (message templates) skills.

## Symptoms → which migration

| You see / have | Migration |
| --- | --- |
| A `flows/<name>/` folder with `flow.config.ts` + `screens/*.tsx` | [1. Folder → single file](#1-folder-model--single-file-flow) |
| `export default function …` screens; `start` / `output` in flow config | [1. Folder → single file](#1-folder-model--single-file-flow) |
| `namePrefix` in the app config; flow names like `acme_grocery` | [2. Drop `namePrefix`](#2-drop-nameprefix) |
| `waba` / `defaultWaba` / `tokenEnv` in the app config | [3. Named environments + token resolver](#3-named-environments--token-resolver) |
| `flows.lock.json` keyed by raw WABA id; "lockfile v1" rejected on push | [4. Lockfile v1 → v2](#4-lockfile-v1--v2) |
| `<SingleColumnLayout>` / `<Layout>`; `<Option>Red</Option>` text children | [5. Component/authoring tweaks](#5-componentauthoring-tweaks) |
| `whatsapp-flow build flows/<folder>`; `ids --env` (boolean) | [6. CLI changes](#6-cli-changes) |

---

## 1. Folder model → single-file flow

**Before** — a flow was a directory: a `flow.config.ts` plus a `screens/` folder where
each `screens/*.tsx` **default-exported** one screen and the *file name* was the route
(`index.tsx` → `/`).

```
flows/grocery/
  flow.config.ts
  screens/
    index.tsx       # → "/"
    confirm.tsx     # → "/confirm"
```

```ts
// flows/grocery/flow.config.ts  (BEFORE)
import { defineFlow } from "whatsapp-flow-tsx";
export default defineFlow({
  name: "grocery_order",
  version: "7.2",
  start: "/",            // removed
  output: "flow.json",   // removed
});
```

```tsx
// flows/grocery/screens/index.tsx  (BEFORE)
import { Screen, Form, TextArea, Footer, Next, field } from "whatsapp-flow-tsx";
export default function Page() {            // default export, file = route
  return (
    <Screen title="Start your order">
      <Form name="form">
        <TextArea name="shopping_list" label="What should we buy?" required />
        <Footer><Next to="/confirm" data={{ shopping_list: field("shopping_list") }}>Continue</Next></Footer>
      </Form>
    </Screen>
  );
}
```

**After** — one `.tsx` file *is* the whole flow: a named `flow` export plus one
**PascalCase function per screen**. The export named **`Index`** is the start screen at
`/`; every other export routes to `/<kebab-of-export-name>`. There is no `start` or
`output` — output goes to `flows/.build/<name>.json`.

```tsx
// flows/grocery.tsx  (AFTER)
import { defineFlow, Screen, Form, TextArea, TextBody, Footer, Next, Complete, field } from "whatsapp-flow-tsx";

export const flow = defineFlow({         // named `flow` export (was `export default`)
  version: "7.2",
  // name defaults to the filename ("grocery"); set `name` to override.
});

export function Index() {                // was screens/index.tsx default export
  return (
    <Screen title="Start your order">
      <Form>
        <TextArea name="shopping_list" label="What should we buy?" required />
        <Footer><Next to="/confirm" data={{ shopping_list: field("shopping_list") }}>Continue</Next></Footer>
      </Form>
    </Screen>
  );
}

export function Confirm() {              // was screens/confirm.tsx → "/confirm"
  return (
    <Screen title="Confirm your order">
      <Form>
        <TextBody>Place your order?</TextBody>
        <Footer><Complete data={{ shopping_list: field("shopping_list") }}>Submit order</Complete></Footer>
      </Form>
    </Screen>
  );
}
```

Mechanical conversion of each old `screens/<file>.tsx`:

- `export default function Page()` → `export function <Pascal>()`, where `<Pascal>` is
  the route in PascalCase. The old `index.tsx` becomes **`Index`** (required — the start
  screen); `confirm.tsx` → `Confirm`; `order-summary.tsx` → `OrderSummary`.
- Routes are now derived from the **export name** (`OrderSummary` → `/order-summary`),
  not the file name. Update `<Next to="…">` / `<Exchange>` targets if a screen's route
  changed.
- The previous "start screen" heuristics (first export, or `Index`/`Start`, or
  `flow.start`) are gone — the start screen **must** be the `Index` export.
- `<Form name="form">` no longer needs a `name`; `<Form>` is fine.

Delete the old folder once the single file compiles.

## 2. Drop `namePrefix`

**Before** — the app config carried a `namePrefix` that was prepended to every flow and
template name (`grocery.tsx` → `acme_grocery`).

```ts
// BEFORE
export default defineFlowsApp({
  namePrefix: "acme_",          // removed
  categories: ["SIGN_IN"],      // app-level default removed; set per-flow instead
  // …
});
```

**After** — `namePrefix` no longer exists. A name now defaults to the **file basename,
lowercased** (`grocery.tsx` → `grocery`). To keep an existing Meta asset name, set it
explicitly per flow/template so the lockfile still matches the live asset:

```ts
// flows/grocery.tsx  (AFTER)
export const flow = defineFlow({ name: "acme_grocery" });   // pin the old name
```

`categories` is no longer an app-wide default either — move it onto each
`defineFlow({ categories: [...] })` that needs it.

> Renaming an asset (e.g. dropping the `acme_` prefix instead of pinning it) makes
> `push` treat it as a **new** template/flow on Meta. For templates that means a fresh
> review; pin the old `name` unless you intend to recreate the asset.

## 3. Named environments + token resolver

**Before** — the app targeted WABAs via `defaultWaba`, and the token came from the env
var named by `tokenEnv`.

```ts
// BEFORE
export default defineFlowsApp({
  wabas: { dev: { id: "2142…" }, prod: { id: "2687…" } },
  defaultWaba: "dev",                 // → defaultEnv
  tokenEnv: "MY_WA_TOKEN",            // → token resolver (or WHATSAPP_ACCESS_TOKEN)
});
```

(An even older single-WABA `waba: { id: "…" }` becomes one named env, e.g.
`wabas: { prod: { id: "…" } }`.)

**After** — environments are first-class names under `wabas`; pick one with `--env`,
`WHATSAPP_ENV`, or `defaultEnv` (a lone env is auto-picked). The token is resolved by an
optional `token` hook and otherwise falls back to `WHATSAPP_ACCESS_TOKEN`.

```ts
// flows.config.ts  (AFTER)
import { defineFlowsApp, fromCommand } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.3",
  wabas: { dev: { id: "2142…" }, prod: { id: "2687…" } },
  defaultEnv: "dev",                                  // was defaultWaba
  // token (optional). Pick one — or omit and export WHATSAPP_ACCESS_TOKEN:
  token: fromCommand("convex env get WHATSAPP_ACCESS_TOKEN"),
});
```

Replacements for `tokenEnv`:

- Easiest: rename your secret to **`WHATSAPP_ACCESS_TOKEN`** and drop the field — that's
  the default, no `token` needed.
- Keep a custom var name with a function resolver:
  `token: () => process.env.MY_WA_TOKEN!`.
- Shell out (JSON-friendly, also works in `package.json#whatsappFlows`):
  `token: { command: "…" }` or the `fromCommand("…")` helper.
- Per-env token: `token: ({ env }) => env === "prod" ? process.env.PROD! : process.env.DEV!`.

## 4. Lockfile v1 → v2

A pre-existing `flows.lock.json` keyed by raw **WABA id** (v1) is rejected on push with
an upgrade hint (there is no automatic `migrate-lock` command). Upgrade it **by hand,
once**: bump `version` to `2`, replace the top-level `wabas` map with an `envs` map, and
move each WABA's entries under the **env name** that targets it. `wabaId` records which
WABA the env points at. Drop any WABA that no longer maps to an env.

```jsonc
// before — v1 (keyed by raw WABA id)
{
  "version": 1,
  "wabas": {
    "2142644013223594":  { "woolworths_login": { "id": "443…", "rev": 3, "hash": "…", "kind": "flow" } },
    "26870122239247230": { "woolworths_login": { "id": "208…", "rev": 2, "hash": "…", "kind": "flow" } }
  }
}

// after — v2 (keyed by env name; env → wabaId comes from flows.config.ts)
{
  "version": 2,
  "envs": {
    "dev":  { "wabaId": "2142644013223594",  "assets": { "woolworths_login": { "id": "443…", "rev": 3, "hash": "…", "kind": "flow" } } },
    "prod": { "wabaId": "26870122239247230", "assets": { "woolworths_login": { "id": "208…", "rev": 2, "hash": "…", "kind": "flow" } } }
  }
}
```

Keys inside `assets` are unchanged: a bare flow name for flows, `tpl:<name>@<language>`
for templates. Commit the upgraded lockfile so dev and prod ids stay side by side.

## 5. Component/authoring tweaks

- **Layout is implicit.** `<SingleColumnLayout>` / `<Layout>` were removed — write
  `<Screen><Form>…</Form></Screen>` directly; the compiler emits Meta's
  `SingleColumnLayout`.

  ```tsx
  // BEFORE                          // AFTER
  <Screen title="…">                 <Screen title="…">
    <SingleColumnLayout>               <Form>…</Form>
      <Form>…</Form>                 </Screen>
    </SingleColumnLayout>
  </Screen>
  ```

- **`<Option>` / `<NavItem>` need a `title` prop** — text children are no longer
  accepted.

  ```tsx
  // BEFORE                                  // AFTER
  <Option id="red">Red</Option>              <Option id="red" title="Red" />
  <NavItem id="a">Account</NavItem>          <NavItem id="a" title="Account" onClickAction={<Next to="/x" />} />
  ```

## 6. CLI changes

- **No per-folder build.** `whatsapp-flow build flows/<folder>` (and the matching
  `check`/`inspect <folder>`) are gone. Run the commands from the app root with no path
  — they act on **every** flow and template:
  `whatsapp-flow check` / `build` / `inspect` / `push`.
- **`ids --env` changed meaning.** It now takes an env *name* (`ids --env prod`). The old
  boolean flag that emitted an `export`-line form was renamed **`--env-line`**.
- **Generated ids module.** On push, the typed ids module is written to
  `whatsapp-flows.generated.ts` (all envs, with `flowId()` / `templateId()` helpers).
  Update imports if you previously read a differently-named generated file, and commit
  the new one.

## Verify

After applying the relevant migrations:

```bash
pnpm flows check          # compiles every flow + template; surfaces leftover issues
pnpm flows build          # writes flows/.build/<name>.json (+ .template.json)
pnpm flows push --dry-run  # confirms the lockfile parses and shows create/edit/skip
```

`check` clean means the source migrated; a clean `push --dry-run` (with a token) means
the v2 lockfile and env config line up with what's live on Meta.
