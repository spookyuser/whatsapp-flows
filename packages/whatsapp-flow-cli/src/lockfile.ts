import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface LockEntry {
  /** Meta flow id (WABA-scoped). */
  id: string;
  /** Deploy revision; bumps each time the compiled JSON changes. */
  rev: number;
  /** Content hash of the compiled flow JSON. */
  hash: string;
}

export interface Lockfile {
  version: number;
  /** waba label -> flow name -> entry. Flow ids differ per WABA. */
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

/** Stable content hash of a compiled flow. assembleFlow output is deterministic
 * (screens ordered, edges sorted), so JSON.stringify is reproducible. */
export function hashFlow(flow: unknown): string {
  return createHash("sha256").update(JSON.stringify(flow)).digest("hex").slice(0, 16);
}
