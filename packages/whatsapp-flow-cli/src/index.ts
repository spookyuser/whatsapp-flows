#!/usr/bin/env node
import { buildFlowJsonSchema, FlowCompileError, FlowCompileErrors } from "whatsapp-flow-core";
import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileFlow, writeFlow } from "./build.ts";
import { runIds } from "./ids.ts";
import { renderInspect } from "./inspect.ts";
import { isProjectDir } from "./project.ts";
import { buildProject, checkProject, inspectProject, pushProject } from "./push.ts";

export { compileFlow, writeFlow } from "./build.ts";
export { renderInspect } from "./inspect.ts";
export { compileFlowFile } from "./single-file.ts";
export { compileTemplateFile, type CompiledTemplate } from "./compile-template.ts";
export { pushProject, checkProject, buildProject } from "./push.ts";
export { runIds, buildIdMap, selectWaba, type IdMap } from "./ids.ts";

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

/** Resolve the target for project-aware commands. A flows app (flows.config.ts)
 * takes precedence; otherwise the argument is treated as a single folder flow. */
function resolveTarget(dir: string | undefined): string {
  if (dir) return dir;
  if (isProjectDir("flows")) return "flows";
  return ".";
}

export function makeProgram(): Command {
  const program = new Command();
  program
    .name("whatsapp-flow")
    .description("Compile TSX flows into Meta WhatsApp Flow JSON, and push them to Meta.");

  program
    .command("build")
    .argument("[dir]", "flows app dir, or a single folder flow")
    .option("--out <path>", "output path (single folder flow) or build dir (project)")
    .description("Compile flow(s). A flows app compiles every flow to <dir>/.build/")
    .action(async (dir: string | undefined, opts: { out?: string }) => {
      try {
        const target = resolveTarget(dir);
        if (isProjectDir(target)) {
          await buildProject(target, opts.out);
        } else {
          const result = await compileFlow(target, { out: opts.out });
          printWarnings(result.warnings);
          const out = await writeFlow(result);
          console.log(`✓ Wrote ${result.flow.screens.length} screen(s) to ${out}`);
        }
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("check")
    .argument("[dir]", "flows app dir, or a single folder flow")
    .description("Validate flow(s) without writing output")
    .action(async (dir: string | undefined) => {
      try {
        const target = resolveTarget(dir);
        if (isProjectDir(target)) {
          await checkProject(target);
        } else {
          const result = await compileFlow(target);
          printWarnings(result.warnings);
          console.log(`✓ ${result.flow.screens.length} screen(s) valid`);
        }
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("inspect")
    .argument("[dir]", "flows app dir, or a single folder flow")
    .description("Print the route map, screen ids, transitions, and warnings")
    .action(async (dir: string | undefined) => {
      try {
        const target = resolveTarget(dir);
        if (isProjectDir(target)) {
          await inspectProject(target);
        } else {
          console.log(renderInspect(await compileFlow(target)));
        }
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("push")
    .argument("[dir]", "flows app dir (contains flows.config.ts)")
    .option("--publish", "also publish each touched flow (goes live)")
    .option("--dry-run", "print the plan; send nothing to Meta")
    .option("--waba <target>", "prod | dev | both | WABA_ID (default: flows.config defaultWaba)")
    .description("Compile every flow and sync it to Meta (create/update drafts)")
    .action(async (dir: string | undefined, opts: { publish?: boolean; dryRun?: boolean; waba?: string }) => {
      try {
        await pushProject(resolveTarget(dir), {
          publish: opts.publish,
          dryRun: opts.dryRun,
          waba: opts.waba,
        });
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("ids")
    .argument("[dir]", "flows app dir (contains flows.config.ts)")
    .option("--waba <target>", "dev | prod | WABA label (default: flows.config defaultWaba)")
    .option("--env", "print as WHATSAPP_FLOWS='{...}' (one line, for a .env file)")
    .option("--out <path>", "write a typed TS module (export const WHATSAPP_FLOWS) to <path>")
    .description("Print locked Meta asset ids ({ flows, templates }) for a WABA, from flows.lock.json")
    .action(async (dir: string | undefined, opts: { waba?: string; env?: boolean; out?: string }) => {
      try {
        await runIds(resolveTarget(dir), { waba: opts.waba, env: opts.env, out: opts.out });
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
