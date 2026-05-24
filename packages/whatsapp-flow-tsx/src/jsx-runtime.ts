import { type AuthoringChild, type AuthoringNode, FRAGMENT_NODE, node } from "whatsapp-flow-core";

/** Fragment marker, so `<>...</>` groups children without a wrapper element. */
export const Fragment = FRAGMENT_NODE;

type Component = (props: Record<string, unknown>) => AuthoringNode;

/** Automatic JSX runtime entry. Components are plain builder functions that we
 * invoke eagerly — there is no React reconciler. Raw host elements (e.g. <div>)
 * are rejected because WhatsApp Flows have no such concept. */
export function jsx(type: unknown, props: Record<string, unknown>): AuthoringNode {
  if (type === Fragment) {
    return node(FRAGMENT_NODE, {}, props?.children as AuthoringChild);
  }
  if (typeof type === "function") {
    return (type as Component)(props ?? {});
  }
  if (typeof type === "string") {
    throw new Error(
      `Raw element <${type}> is not supported in WhatsApp Flows. Use the Flow components from "whatsapp-flow-tsx".`,
    );
  }
  throw new Error(`Unsupported JSX element type: ${String(type)}`);
}

export const jsxs = jsx;
export const jsxDEV = jsx;

// Type-only JSX namespace so .tsx flow files type-check with our components and
// reject raw HTML elements.
export namespace JSX {
  export type Element = AuthoringNode;
  export type ElementType = (props: never) => AuthoringNode;
  // Empty: any intrinsic/raw element like <div> is a type error.
  export interface IntrinsicElements {}
  export interface ElementChildrenAttribute {
    children: object;
  }
}
