// Output: Meta WhatsApp Flow JSON AST.
// Component property keys are kebab-cased in Flow JSON (e.g. "input-type",
// "data-source", "on-click-action"); the camelCase -> kebab mapping happens in
// normalize.ts, driven by specs.ts.

export type FlowValue = string;

export interface FlowJson {
  version: string;
  /** Only present when the flow uses an endpoint / data_exchange action. */
  data_api_version?: string;
  routing_model: Record<string, string[]>;
  screens: FlowScreen[];
}

export interface FlowScreen {
  id: string;
  title?: string;
  terminal?: boolean;
  success?: boolean;
  data?: Record<string, unknown>;
  layout: FlowLayout;
}

export interface FlowLayout {
  type: "SingleColumnLayout";
  children: FlowComponent[];
}

// --- Actions ---------------------------------------------------------------

export interface NavigateAction {
  name: "navigate";
  next: { type: "screen"; name: string };
  payload?: Record<string, unknown>;
}
export interface CompleteAction {
  name: "complete";
  payload?: Record<string, unknown>;
}
export interface DataExchangeAction {
  name: "data_exchange";
  payload?: Record<string, unknown>;
}
export interface OpenUrlAction {
  name: "open_url";
  url: string;
}
export interface UpdateDataAction {
  name: "update_data";
  payload: Record<string, unknown>;
}
export type FlowAction =
  | NavigateAction
  | CompleteAction
  | DataExchangeAction
  | OpenUrlAction
  | UpdateDataAction;

// --- Components ------------------------------------------------------------

export interface DataSourceItem {
  id: string;
  title: string;
  description?: string;
  metadata?: string;
  enabled?: boolean;
  image?: string;
  "alt-text"?: string;
}

/** A compiled Flow component. Concrete property sets are validated by the
 * generated JSON Schema (json-schema.ts); the type stays open here. */
export interface FlowComponent {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Authoring AST (produced by the TSX layer, consumed by normalize.ts)
// ---------------------------------------------------------------------------

export type AuthoringChild = AuthoringNode | string | number | boolean | null | undefined;

export interface AuthoringNode {
  readonly $kind: "flow-node";
  readonly component: string;
  readonly props: Record<string, unknown>;
  readonly children: AuthoringNode[];
}

export const TEXT_NODE = "#text";
export const FRAGMENT_NODE = "#fragment";
