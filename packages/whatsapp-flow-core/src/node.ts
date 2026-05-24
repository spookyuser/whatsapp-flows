import { type AuthoringChild, type AuthoringNode, FRAGMENT_NODE, TEXT_NODE } from "./types.ts";

/** Create an authoring AST node. Used by the TSX layer's components. */
export function node(
  component: string,
  props: Record<string, unknown> | null | undefined,
  children?: AuthoringChild | AuthoringChild[],
): AuthoringNode {
  return {
    $kind: "flow-node",
    component,
    props: stripUndefined(props ?? {}),
    children: flattenChildren(children),
  };
}

export function isAuthoringNode(value: unknown): value is AuthoringNode {
  return typeof value === "object" && value !== null && $kindOf(value) === "flow-node";
}

function $kindOf(value: object): unknown {
  return (value as { $kind?: unknown }).$kind;
}

/** Flatten children: arrays/fragments are spread, strings/numbers become #text
 * nodes, and null/undefined/booleans are dropped. */
export function flattenChildren(
  children: AuthoringChild | AuthoringChild[] | undefined,
): AuthoringNode[] {
  const out: AuthoringNode[] = [];
  const visit = (child: AuthoringChild | AuthoringChild[]): void => {
    if (child === null || child === undefined || child === false || child === true) {
      return;
    }
    if (Array.isArray(child)) {
      for (const c of child) visit(c);
      return;
    }
    if (typeof child === "string" || typeof child === "number") {
      const value = String(child);
      if (value.length === 0) return;
      out.push({ $kind: "flow-node", component: TEXT_NODE, props: { value }, children: [] });
      return;
    }
    if (isAuthoringNode(child)) {
      if (child.component === FRAGMENT_NODE) {
        for (const c of child.children) out.push(c);
        return;
      }
      out.push(child);
    }
  };
  visit(children as AuthoringChild);
  return out;
}

function stripUndefined(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === "children") continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Concatenate the text of all #text descendants of a node (used for labels). */
export function textOf(n: AuthoringNode): string {
  if (n.component === TEXT_NODE) return String(n.props.value ?? "");
  return n.children.map(textOf).join("");
}
