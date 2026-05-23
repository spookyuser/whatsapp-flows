#!/usr/bin/env node
import { buildFlowJsonSchema, FlowCompileError, FlowCompileErrors } from "whatsapp-flow-core";
import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileFlow, writeFlow } from "./build.ts";
import { renderInspect } from "./inspect.ts";

export { compileFlow, writeFlow } from "./build.ts";
export { renderInspect } from "./inspect.ts";

function reportError(e: unknown): never {
  if (e instanceof FlowCompileErrors) {
    console.error(`\n${e.message}\n`);
  } else if (e instanceof FlowCompileError) {
    console.error(`\nFlow compilation failed:\n  - ${e.message}\n`);
  } else {
    console.error(`\nUnexpected error: ${(e as Error).stack ?? String(e)}\n`);
  }
  process.exit(1);
}

function printWarnings(warnings: string[]): void {
  for (const w of warnings) console.warn(`warning: ${w}`);
}

export function makeProgram(): Command {
  const program = new Command();
  program
    .name("whatsapp-flow")
    .description("Compile TSX screen files into Meta WhatsApp Flow JSON.");

  program
    .command("build")
    .argument("<dir>", "flow directory containing flow.config.ts and screens/")
    .option("--out <path>", "output path for the compiled flow.json")
    .description("Compile and write flow.json")
    .action(async (dir: string, opts: { out?: string }) => {
      try {
        const result = await compileFlow(dir, { out: opts.out });
        printWarnings(result.warnings);
        const out = await writeFlow(result);
        console.log(`✓ Wrote ${result.flow.screens.length} screen(s) to ${out}`);
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("check")
    .argument("<dir>", "flow directory")
    .description("Validate without writing output")
    .action(async (dir: string) => {
      try {
        const result = await compileFlow(dir);
        printWarnings(result.warnings);
        console.log(`✓ ${result.flow.screens.length} screen(s) valid`);
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("inspect")
    .argument("<dir>", "flow directory")
    .description("Print the route map, screen ids, transitions, and warnings")
    .action(async (dir: string) => {
      try {
        const result = await compileFlow(dir);
        console.log(renderInspect(result));
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("schema")
    .option("--out <path>", "output path", "flow.schema.json")
    .description("Write the JSON Schema used to formally verify Flow JSON")
    .action(async (opts: { out: string }) => {
      const out = path.resolve(process.cwd(), opts.out);
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, JSON.stringify(buildFlowJsonSchema(), null, 2) + "\n", "utf8");
      console.log(`✓ Wrote Flow JSON Schema to ${out}`);
    });

  return program;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  makeProgram().parseAsync(process.argv);
}
