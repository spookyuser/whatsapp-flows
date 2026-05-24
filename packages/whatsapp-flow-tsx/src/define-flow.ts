export interface FlowConfig {
  /** Flow name (Meta flow asset name). Optional — defaults to the project
   * `namePrefix` + the flow's file basename. */
  name?: string;
  /** Flow JSON version, e.g. "7.2". */
  version?: string;
  /** Data API version, e.g. "3.0". Emitted only for endpoint/data_exchange flows. */
  dataApiVersion?: string;
  /** Optional endpoint URI for data exchange. */
  endpointUri?: string;
  /** Optional Meta flow categories. */
  categories?: string[];
}

/** Identity helper that gives a typed `flow` export authoring experience. */
export function defineFlow(config: FlowConfig): FlowConfig {
  return config;
}

/** A deploy target (Meta WhatsApp Business Account). */
export interface WabaConfig {
  /** WABA id used for flow CRUD (`/{waba}/flows`). */
  id: string;
}

/** Project-level config for a flows app — the "next.config.ts" of flows.
 * Lives in `flows.config.ts` and is shared by every flow and template in the
 * project. */
export interface FlowsAppConfig {
  /** Default Flow JSON version applied to flows that don't set their own. */
  version?: string;
  /** Prefix prepended to file-derived flow and template names, e.g. "cart_". */
  namePrefix?: string;
  /** Default categories for flows that don't set their own. */
  categories?: string[];
  /** Default language/locale for message templates that don't set their own.
   * Defaults to "en_US". */
  language?: string;
  /** Named deploy targets, e.g. { prod: { id: "…" }, dev: { id: "…" } }. */
  wabas?: Record<string, WabaConfig>;
  /** Which WABA `flows push` targets by default. Defaults to "dev" when present. */
  defaultWaba?: string;
}

/** Identity helper for a typed flows/flows.config.ts. */
export function defineFlowsApp(config: FlowsAppConfig): FlowsAppConfig {
  return config;
}
