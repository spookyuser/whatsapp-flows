import type { NormalizedScreen } from "./normalize.ts";
import type { FlowJson } from "./types.ts";

export interface AssembleOptions {
  version: string;
  /** Emitted only when the flow uses data_exchange or declares an endpoint. */
  dataApiVersion?: string;
  hasEndpoint?: boolean;
}

/** Assemble normalized screens into a complete Flow JSON document, including the
 * routing_model derived from each screen's transitions. Screen order is
 * preserved; edges are sorted for deterministic, snapshot-stable output. */
export function assembleFlow(screens: NormalizedScreen[], opts: AssembleOptions): FlowJson {
  const routing_model: Record<string, string[]> = {};
  for (const s of screens) {
    routing_model[s.screen.id] = [...new Set(s.edges)].sort();
  }

  const usesDataExchange = screens.some((s) => s.usesDataExchange);
  const flow: FlowJson = {
    version: opts.version,
    routing_model,
    screens: screens.map((s) => s.screen),
  };
  if (usesDataExchange || opts.hasEndpoint) {
    flow.data_api_version = opts.dataApiVersion ?? "3.0";
  }
  // Place data_api_version right after version for readability.
  if (flow.data_api_version) {
    return {
      version: flow.version,
      data_api_version: flow.data_api_version,
      routing_model: flow.routing_model,
      screens: flow.screens,
    };
  }
  return flow;
}
