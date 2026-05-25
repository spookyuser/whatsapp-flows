import { FlowCompileError } from "whatsapp-flow-core";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";

export interface LockEntry {
  /** Meta asset id (WABA-scoped). */
  id: string;
  /** Deploy revision; bumps each time the compiled content changes. */
  rev: number;
  /** Content hash of the compiled flow JSON / template payload. */
  hash: string;
  /** Asset kind. Absent on legacy entries, which are flows. */
  kind?: "flow" | "template";
  /** Last known Meta review status (templates only), e.g. "PENDING". */
  status?: string;
}

/** One env's locked state: which WABA it points at, plus its asset entries. */
export interface EnvLock {
  /** WABA id this env deploys to. */
  wabaId: string;
  /** asset key -> entry. Flow keys are the flow name; template keys are
   * `tpl:<name>@<language>`. */
  assets: Record<string, LockEntry>;
}

export interface Lockfile {
  version: number;
  /** env name -> { wabaId, assets }. Keying by env name (not raw WABA id) means
   * one committed lockfile holds dev and prod state with stable, readable keys. */
  envs: Record<string, EnvLock>;
}

/** The pre-v2 shape: keyed by raw WABA id. Read only by the migrate command. */
export interface LegacyLockfile {
  version: number;
  wabas: Record<string, Record<string, LockEntry>>;
}

export const LOCK_VERSION = 2;
const LOCK_NAME = "flows.lock.json";

export function lockPath(flowsDir: string): string {
  return path.join(flowsDir, LOCK_NAME);
}

/** True when a parsed lockfile object is in the legacy v1 (WABA-keyed) shape. */
export function isLegacyLock(raw: unknown): raw is LegacyLockfile {
  const obj = raw as { version?: number; envs?: unknown; wabas?: unknown };
  return !!obj && (obj.version === 1 || (obj.wabas !== undefined && obj.envs === undefined));
}

export async function readLock(flowsDir: string): Promise<Lockfile> {
  const p = lockPath(flowsDir);
  if (!existsSync(p)) return { version: LOCK_VERSION, envs: {} };
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(p, "utf8"));
  } catch {
    return { version: LOCK_VERSION, envs: {} };
  }
  if (isLegacyLock(raw)) {
    throw new FlowCompileError(
      "flows.lock.json is a v1 lockfile (keyed by raw WABA id). Run " +
        "`whatsapp-flow migrate-lock` to upgrade it to v2 (keyed by env name).",
    );
  }
  const parsed = raw as Lockfile;
  if (!parsed.envs) parsed.envs = {};
  return parsed;
}

export async function writeLock(flowsDir: string, lock: Lockfile): Promise<void> {
  await writeFile(lockPath(flowsDir), JSON.stringify(lock, null, 2) + "\n", "utf8");
}

/** Pure v1 → v2 migration. Pairs each raw WABA id in the legacy lock with an env
 * name from the (already updated) config's `wabas`. WABAs absent from the config
 * are dropped and reported in `dropped`. */
export function migrateLockV1ToV2(
  legacy: LegacyLockfile,
  app: FlowsAppConfig,
): { lock: Lockfile; dropped: string[] } {
  const envByWaba = new Map<string, string>();
  for (const [env, cfg] of Object.entries(app.wabas ?? {})) {
    if (cfg.id) envByWaba.set(cfg.id, env);
  }
  const envs: Record<string, EnvLock> = {};
  const dropped: string[] = [];
  for (const [wabaId, assets] of Object.entries(legacy.wabas ?? {})) {
    const env = envByWaba.get(wabaId);
    if (!env) {
      dropped.push(wabaId);
      continue;
    }
    envs[env] = { wabaId, assets };
  }
  return { lock: { version: LOCK_VERSION, envs }, dropped };
}

/** Stable content hash of a compiled asset. Compiler output is deterministic
 * (flow screens ordered/edges sorted; template keys emitted in fixed order), so
 * JSON.stringify is reproducible. */
export function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
