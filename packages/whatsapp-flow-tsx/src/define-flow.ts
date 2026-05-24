export interface FlowConfig {
  /** Flow name (Meta flow asset name). Defaults to the flow's file basename. */
  name?: string;
  /** Flow JSON version, e.g. "7.2". */
  version?: string;
  /** Data API version, e.g. "3.0". Emitted only for endpoint/data_exchange flows. */
  dataApiVersion?: string;
  /** Optional endpoint URI for data exchange. */
  endpointUri?: string;
  /** Meta flow categories for this flow. */
  categories?: string[];
}

/** Identity helper that gives a typed `flow` export authoring experience. */
export function defineFlow(config: FlowConfig): FlowConfig {
  return config;
}

/** The deploy target (a Meta WhatsApp Business Account). */
export interface WabaConfig {
  /** WABA id used for flow CRUD (`/{waba}/flows`). Typically read from an env
   * var so the same `flows.config.ts` works in dev and prod checkouts. */
  id: string;
}

/** Project-level config for a flows app — the "next.config.ts" of flows.
 * Lives in `flows.config.ts` and is shared by every flow and template in the
 * project. One WABA per checkout: swap dev/prod by switching the env file
 * (`.env.local` vs `.env.production`), not by passing a flag. */
export interface FlowsAppConfig {
  /** Default Flow JSON version applied to flows that don't set their own. */
  version?: string;
  /** Default language/locale for message templates that don't set their own.
   * Defaults to "en_US". */
  language?: string;
  /** The WABA `flows push` targets. Read the id from env (e.g.
   * `{ id: process.env.WHATSAPP_WABA_ID! }`). */
  waba?: WabaConfig;
  /** Where `flows push` writes the typed ids module. Relative paths are
   * resolved against the flows directory. Defaults to
   * `whatsapp-flows.generated.ts` inside the flows directory. */
  generatedIdsPath?: string;
}

/** Identity helper for a typed flows/flows.config.ts. */
export function defineFlowsApp(config: FlowsAppConfig): FlowsAppConfig {
  return config;
}
