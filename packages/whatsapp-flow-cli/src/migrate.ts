import { FlowCompileError } from "whatsapp-flow-core";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  isLegacyLock,
  type LegacyLockfile,
  lockPath,
  migrateLockV1ToV2,
  writeLock,
} from "./lockfile.ts";
import { findProjectDir, loadAppConfig } from "./project.ts";

/** Upgrade a flows.lock.json from v1 (keyed by raw WABA id) to v2 (keyed by env
 * name), using the current config's `wabas` to pair raw ids with env names. */
export async function runMigrateLock(flowsDir?: string): Promise<void> {
  const dir =
    flowsDir !== undefined
      ? path.resolve(flowsDir)
      : (findProjectDir(process.cwd()) ??
        (() => {
          throw new FlowCompileError(`Walked up from ${process.cwd()} and found no flows app.`);
        })());

  const app = await loadAppConfig(dir);
  const p = lockPath(dir);
  if (!existsSync(p)) {
    throw new FlowCompileError(`No flows.lock.json in "${dir}". Nothing to migrate.`);
  }
  const raw = JSON.parse(await readFile(p, "utf8")) as unknown;
  if (!isLegacyLock(raw)) {
    console.log("flows.lock.json is already v2 (keyed by env name). Nothing to do.");
    return;
  }

  const { lock, dropped } = migrateLockV1ToV2(raw as LegacyLockfile, app);
  await writeLock(dir, lock);
  const envs = Object.keys(lock.envs).join(", ") || "(none)";
  console.log(`✓ Migrated flows.lock.json to v2 — envs: ${envs}`);
  if (dropped.length) {
    console.log(
      `  ⚠ Dropped ${dropped.length} WABA(s) not in flows.config.ts \`wabas\`: ${dropped.join(", ")}`,
    );
  }
}
