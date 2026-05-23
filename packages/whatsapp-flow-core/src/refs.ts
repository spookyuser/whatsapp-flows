import { routeToScreenId } from "./route-id.ts";

declare const refBrand: unique symbol;
/** A Flow JSON dynamic reference string, e.g. `${form.shopping_list}`. */
export type Ref = string & { readonly [refBrand]?: true };

const REF_RE = /^\$\{[^}]+\}$/;

export function isRef(value: unknown): value is Ref {
  return typeof value === "string" && REF_RE.test(value);
}

/** Reference a value entered into the current screen's form: `${form.<name>}`. */
export function field(name: string): Ref {
  return `\${form.${name}}` as Ref;
}

/** Reference a value from the current screen's input data: `${data.<key>}`. */
export function data(key: string): Ref {
  return `\${data.${key}}` as Ref;
}

/** Reference a value carried by another screen by route or id:
 * `${screen.<SCREEN_ID>.data.<key>}`. The first argument accepts either a route
 * ("/confirm") or a screen id ("CONFIRM"). */
export function screenData(screenOrRoute: string, key: string): Ref {
  const id = routeToScreenId(screenOrRoute);
  return `\${screen.${id}.data.${key}}` as Ref;
}
