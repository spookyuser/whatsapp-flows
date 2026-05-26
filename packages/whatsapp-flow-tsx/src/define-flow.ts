export interface FlowConfig {
  /** Flow name (Meta flow asset name). Defaults to the flow's file basename. */
  name?: string;
  /** Flow JSON version, e.g. "7.3". */
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

/** One deploy target — a Meta WhatsApp Business Account — named by environment. */
export interface EnvConfig {
  /** WABA id used for flow/template CRUD (`/{waba}/flows`). */
  id: string;
  /** Phone number for this env. Documentation only — never read by the CLI. */
  phone?: string;
}

/** Context handed to a {@link TokenResolver} function when `push` needs a token. */
export interface TokenContext {
  /** The env being targeted, e.g. "dev". */
  env: string;
  /** The WABA id resolved for that env. */
  wabaId: string;
}

/** How `push` obtains the Graph API access token. Either a literal string, a
 * JSON-friendly `{ command }` to shell out to (see `fromCommand`), or a function
 * computing it (sync or async). When unset, `push` falls back to the
 * `WHATSAPP_ACCESS_TOKEN` env var. */
export type TokenResolver =
  | string
  | { command: string }
  | ((ctx: TokenContext) => string | Promise<string>);

/** Project-level config for a flows app — the "next.config.ts" of flows. Lives
 * in `flows.config.ts` and is shared by every flow and template in the project.
 * Declares one or more named environments (`wabas`); `push --env <name>` (or the
 * `WHATSAPP_ENV` var) picks which one to target. */
export interface FlowsAppConfig {
  /** Default Flow JSON version applied to flows that don't set their own. */
  version?: string;
  /** Default language/locale for message templates that don't set their own.
   * Defaults to "en_US". */
  language?: string;
  /** Named deploy targets, e.g. `{ dev: { id: "21…" }, prod: { id: "26…" } }`.
   * The committed lockfile is keyed by these env names. */
  wabas: Record<string, EnvConfig>;
  /** Env used when neither `--env` nor `WHATSAPP_ENV` is set. With a single
   * env it is auto-picked; with several, set this or pass `--env`. */
  defaultEnv?: string;
  /** How `push` obtains the access token. Defaults to `WHATSAPP_ACCESS_TOKEN`. */
  token?: TokenResolver;
  /** Where `flows push` writes the typed ids module. Relative paths are
   * resolved against the flows directory. Defaults to
   * `whatsapp-flows.generated.ts` inside the flows directory. */
  generatedIdsPath?: string;
}

/** Identity helper for a typed flows/flows.config.ts. */
export function defineFlowsApp(config: FlowsAppConfig): FlowsAppConfig {
  return config;
}
