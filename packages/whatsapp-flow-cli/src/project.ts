import { FlowCompileError } from "whatsapp-flow-core";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import { loadModule } from "./load-module.ts";

const CONFIG_NAME = "flows.config.ts";

export interface LoadedProject {
  /** Absolute path to the project directory. */
  dir: string;
  app: FlowsAppConfig;
  /** Absolute paths to each flow/template .tsx file, sorted. */
  flowFiles: string[];
}

/** True when `dir` is a flows app (has a flows.config.ts). */
export function isProjectDir(dir: string): boolean {
  return existsSync(path.join(path.resolve(dir), CONFIG_NAME));
}

export async function loadProject(flowsDir: string): Promise<LoadedProject> {
  const dir = path.resolve(flowsDir);
  const configPath = path.join(dir, CONFIG_NAME);
  if (!existsSync(configPath)) {
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
      `No flow files (*.tsx) found in "${dir}". Each top-level .tsx is one flow or template.`,
    );
  }

  return { dir, app, flowFiles };
}
