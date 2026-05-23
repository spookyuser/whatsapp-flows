export interface FlowConfig {
  /** Flow name (Meta flow asset name). */
  name: string;
  /** Flow JSON version, e.g. "7.2". */
  version?: string;
  /** Data API version, e.g. "3.0". Emitted only for endpoint/data_exchange flows. */
  dataApiVersion?: string;
  /** Start route, defaults to "/". */
  start?: string;
  /** Output path for the compiled flow.json (relative to the flow dir). */
  output?: string;
  /** Optional endpoint URI for data exchange. */
  endpointUri?: string;
  /** Optional Meta flow categories. */
  categories?: string[];
  /** Treat warnings as errors. Defaults to true. */
  strict?: boolean;
}

/** Identity helper that gives a typed flow.config.ts authoring experience. */
export function defineFlow(config: FlowConfig): FlowConfig {
  return config;
}
