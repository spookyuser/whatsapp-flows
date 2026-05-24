import { FlowCompileError } from "whatsapp-flow-core";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import { loadModule } from "./load-module.ts";

const CONFIG_NAMES = ["flows.config.ts", "flows.config.js", "flows.config.mjs"];

export interface LoadedProject {
  /** Absolute path to the flows/ project directory. */
  dir: string;
  app: FlowsAppConfig;
  /** Absolute paths to each flow's single .tsx file, sorted. */
  flowFiles: string[];
}

/** True when `dir` is a flows app (has a flows.config.ts). */
export function isProjectDir(dir: string): boolean {
  const resolved = path.resolve(dir);
  return CONFIG_NAMES.some((f) => existsSync(path.join(resolved, f)));
}

export async function loadProject(flowsDir: string): Promise<LoadedProject> {
  const dir = path.resolve(flowsDir);
  const configPath = CONFIG_NAMES.map((f) => path.join(dir, f)).find((f) => existsSync(f));
  if (!configPath) {
    throw new FlowCompileError(
      `No flows.config.ts in "${flowsDir}". Create one with defineFlowsApp({ ... }).`,
    );
  }

  const mod = await loadModule(configPath);
  const app = (mod.default ?? mod.app ?? {}) as FlowsAppConfig;

  const entries = await readdir(dir, { withFileTypes: true });
  const flowFiles = entries
    .filter((e) => e.isFile() && /\.(tsx|jsx)$/.test(e.name))
    .map((e) => path.join(dir, e.name))
    .sort();
  if (flowFiles.length === 0) {
    throw new FlowCompileError(
      `No flow files (*.tsx) found in "${dir}". Each top-level .tsx is one flow.`,
    );
  }

  return { dir, app, flowFiles };
}
