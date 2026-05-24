import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

export interface Lockfile {
  version: number;
  /** waba id -> asset key -> entry. Flow keys are the flow name; template
   * keys are `tpl:<name>@<language>`. Asset ids differ per WABA. Keying by
   * id (not label) means dev and prod checkouts share one committed lockfile. */
  wabas: Record<string, Record<string, LockEntry>>;
}

const LOCK_NAME = "flows.lock.json";

export function lockPath(flowsDir: string): string {
  return path.join(flowsDir, LOCK_NAME);
}

export async function readLock(flowsDir: string): Promise<Lockfile> {
  const p = lockPath(flowsDir);
  if (!existsSync(p)) return { version: 1, wabas: {} };
  try {
    const parsed = JSON.parse(await readFile(p, "utf8")) as Lockfile;
    if (!parsed.wabas) parsed.wabas = {};
    return parsed;
  } catch {
    return { version: 1, wabas: {} };
  }
}

export async function writeLock(flowsDir: string, lock: Lockfile): Promise<void> {
  await writeFile(lockPath(flowsDir), JSON.stringify(lock, null, 2) + "\n", "utf8");
}

/** Stable content hash of a compiled asset. Compiler output is deterministic
 * (flow screens ordered/edges sorted; template keys emitted in fixed order), so
 * JSON.stringify is reproducible. */
export function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
