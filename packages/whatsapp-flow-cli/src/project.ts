import { FlowCompileError } from "whatsapp-flow-core";
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { type FlowsAppConfig, fromCommand, type TokenContext } from "whatsapp-flow-tsx";
import { loadModule } from "./load-module.ts";

const CONFIG_NAME = "flows.config.ts";
const PKG_NAME = "package.json";
const PKG_KEY = "whatsappFlows";

export interface LoadProjectOptions {
  /** Explicit env name (highest precedence in `resolveEnv`). */
  env?: string;
}

export interface LoadedProject {
  /** Absolute path to the project directory. */
  dir: string;
  app: FlowsAppConfig;
  /** Absolute paths to each flow/template .tsx file, sorted. */
  flowFiles: string[];
  /** Resolved env name for this invocation. */
  env: string;
  /** WABA id the resolved env targets. */
  wabaId: string;
}

/** Read `package.json#whatsappFlows` from `dir`, or null if absent/invalid. */
function readPackageConfig(dir: string): FlowsAppConfig | null {
  const p = path.join(dir, PKG_NAME);
  if (!existsSync(p)) return null;
  try {
    const pkg = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    const cfg = pkg[PKG_KEY];
    if (cfg && typeof cfg === "object") return cfg as FlowsAppConfig;
  } catch {
    return null;
  }
  return null;
}

/** True when `dir` holds a flows app — a flows.config.ts or a package.json with
 * a `whatsappFlows` key. */
export function isProjectDir(dir: string): boolean {
  const d = path.resolve(dir);
  return existsSync(path.join(d, CONFIG_NAME)) || readPackageConfig(d) !== null;
}

/** Walk up from `startDir` looking for a flows app (flows.config.ts, or a
 * package.json with `whatsappFlows`). Returns the directory, or null at root. */
export function findProjectDir(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    if (isProjectDir(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Load the app config from `dir`: prefer flows.config.ts, fall back to
 * package.json#whatsappFlows. */
export async function loadAppConfig(dir: string): Promise<FlowsAppConfig> {
  const configPath = path.join(dir, CONFIG_NAME);
  if (existsSync(configPath)) {
    const mod = await loadModule(configPath);
    return (mod.default ?? mod.app ?? {}) as FlowsAppConfig;
  }
  const pkg = readPackageConfig(dir);
  if (pkg) return pkg;
  throw new FlowCompileError(
    `No flows.config.ts (or package.json#whatsappFlows) in "${dir}". ` +
      "Create one with defineFlowsApp({ ... }).",
  );
}

/** Pick the env for this invocation: explicit option > WHATSAPP_ENV >
 * defaultEnv > single-key auto-pick > throw. */
export function resolveEnv(app: FlowsAppConfig, opts: LoadProjectOptions = {}): string {
  const explicit = opts.env?.trim();
  if (explicit) return explicit;
  const fromVar = process.env.WHATSAPP_ENV?.trim();
  if (fromVar) return fromVar;
  const fallback = app.defaultEnv?.trim();
  if (fallback) return fallback;
  const keys = Object.keys(app.wabas ?? {});
  if (keys.length === 1) return keys[0]!;
  if (keys.length === 0) {
    throw new FlowCompileError(
      'No `wabas` in flows.config.ts. Add at least one env, e.g. `wabas: { dev: { id: "…" } }`.',
    );
  }
  throw new FlowCompileError(
    `Ambiguous env: flows.config.ts defines ${keys.length} wabas (${keys.join(", ")}). ` +
      "Pass --env <name>, set WHATSAPP_ENV, or add `defaultEnv` to flows.config.ts.",
  );
}

/** The WABA id the given env targets; throws with the known envs if missing. */
export function resolveWabaId(app: FlowsAppConfig, env: string): string {
  const id = app.wabas?.[env]?.id?.trim();
  if (!id) {
    const known = Object.keys(app.wabas ?? {}).join(", ") || "(none)";
    throw new FlowCompileError(
      `No WABA id for env "${env}" in flows.config.ts. Known envs: ${known}.`,
    );
  }
  return id;
}

/** Resolve the flows app directory: an explicit `flowsDir` (resolved against the
 * cwd), or, when omitted, the first flows app found walking up from the cwd. */
export function resolveProjectDir(flowsDir?: string): string {
  if (flowsDir !== undefined) return path.resolve(flowsDir);
  const found = findProjectDir(process.cwd());
  if (!found) {
    throw new FlowCompileError(
      `Walked up from ${process.cwd()} and found no ${CONFIG_NAME} ` +
        `(or package.json#${PKG_KEY}) up the tree.`,
    );
  }
  return found;
}

/** Resolve the Graph API access token: function form > `{ command }` > literal
 * string > `WHATSAPP_ACCESS_TOKEN` env var > error. */
export async function resolveToken(app: FlowsAppConfig, ctx: TokenContext): Promise<string> {
  const t = app.token;
  if (typeof t === "function") return (await t(ctx)).trim();
  if (t && typeof t === "object" && typeof t.command === "string") {
    return fromCommand(t.command)(ctx).trim();
  }
  if (typeof t === "string" && t.trim()) return t.trim();
  const env = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (env) return env;
  throw new FlowCompileError(
    "No access token. Set `token` in flows.config.ts (a string, `{ command }`, or a " +
      "function), or export WHATSAPP_ACCESS_TOKEN, e.g.\n" +
      "  dotenvx run -f .env.local -- pnpm flows push",
  );
}

/** Load a flows app. With no `flowsDir`, walks up from the cwd to discover one;
 * pass "." for cwd-explicit. Resolves the target env and its WABA id. */
export async function loadProject(
  flowsDir?: string,
  opts: LoadProjectOptions = {},
): Promise<LoadedProject> {
  const dir = resolveProjectDir(flowsDir);
  const app = await loadAppConfig(dir);

  const entries = await readdir(dir, { withFileTypes: true });
  const flowFiles = entries
    .filter((e) => e.isFile() && /\.(tsx|jsx)$/.test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort();
  if (flowFiles.length === 0) {
    throw new FlowCompileError(
      `No flow files (*.tsx) found in "${dir}". Each top-level .tsx is one flow or template.`,
    );
  }

  const env = resolveEnv(app, opts);
  const wabaId = resolveWabaId(app, env);
  return { dir, app, flowFiles, env, wabaId };
}
