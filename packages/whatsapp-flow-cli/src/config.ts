import { FlowCompileError } from "whatsapp-flow-core";
import type { FlowConfig } from "whatsapp-flow-tsx";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadModule } from "./load-module.ts";

export interface ResolvedConfig {
  name: string;
  version: string;
  dataApiVersion: string;
  start: string;
  output: string;
  endpointUri?: string;
  categories?: string[];
  strict: boolean;
  dir: string;
}

const DEFAULTS = {
  version: "7.3",
  dataApiVersion: "3.0",
  start: "/",
  strict: true,
} as const;

export async function loadConfig(flowDir: string): Promise<ResolvedConfig> {
  const dir = path.resolve(flowDir);
  const configPath = ["flow.config.ts", "flow.config.js", "flow.config.mjs"]
    .map((f) => path.join(dir, f))
    .find((f) => existsSync(f));

  if (!configPath) {
    throw new FlowCompileError(
      `No flow.config.ts found in "${flowDir}". Create one with defineFlow({ name, output }).`,
    );
  }

  const mod = await loadModule(configPath);
  const config = (mod.default ?? mod.config) as FlowConfig | undefined;
  if (!config || typeof config.name !== "string") {
    throw new FlowCompileError(`flow.config.ts must \`export default defineFlow({ name, ... })\`.`);
  }

  const output = config.output ? path.resolve(dir, config.output) : path.resolve(dir, "flow.json");

  return {
    name: config.name,
    version: config.version ?? DEFAULTS.version,
    dataApiVersion: config.dataApiVersion ?? DEFAULTS.dataApiVersion,
    start: config.start ?? DEFAULTS.start,
    output,
    endpointUri: config.endpointUri,
    categories: config.categories,
    strict: config.strict ?? DEFAULTS.strict,
    dir,
  };
}
