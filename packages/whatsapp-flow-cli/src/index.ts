#!/usr/bin/env node
import { buildFlowJsonSchema, FlowCompileError, FlowCompileErrors } from "whatsapp-flow-core";
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runIds } from "./ids.ts";
import { buildProject, checkProject, inspectProject, pushProject } from "./push.ts";

export { compileFlowFile } from "./single-file.ts";
export { compileTemplateFile, type CompiledTemplate } from "./compile-template.ts";
export { pushProject, checkProject, buildProject } from "./push.ts";
export { runIds, buildIdMap, resolveLockedWaba, type IdMap } from "./ids.ts";

function reportError(e: unknown): never {
  if (e instanceof FlowCompileErrors) {
    console.error(`\n${e.message}\n`);
  } else if (e instanceof FlowCompileError) {
    console.error(`\nFlow compilation failed:\n  - ${e.message}\n`);
  } else {
    const err = e as Error & { cause?: unknown };
    console.error(`\nUnexpected error: ${err.stack ?? String(err)}`);
    if (err.cause) {
      const cause = err.cause as Error;
      console.error(`  caused by: ${cause.stack ?? String(cause)}`);
    }
    console.error();
  }
  process.exit(1);
}

export function makeProgram(): Command {
  const program = new Command();
  program
    .name("whatsapp-flow")
    .description("Compile TSX flows into Meta WhatsApp Flow JSON, and push them to Meta.");

  program
    .command("build")
    .argument("[dir]", "flows app dir (contains flows.config.ts)", ".")
    .option("--out <path>", "build dir (default: <dir>/.build)")
    .description("Compile every flow and template to <dir>/.build/")
    .action(async (dir: string, opts: { out?: string }) => {
      try {
        await buildProject(dir, opts.out);
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("check")
    .argument("[dir]", "flows app dir (contains flows.config.ts)", ".")
    .description("Validate every flow and template without writing output")
    .action(async (dir: string) => {
      try {
        await checkProject(dir);
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("inspect")
    .argument("[dir]", "flows app dir (contains flows.config.ts)", ".")
    .description("Outline each flow (routes/ids/transitions) and each template")
    .action(async (dir: string) => {
      try {
        await inspectProject(dir);
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("push")
    .argument("[dir]", "flows app dir (contains flows.config.ts)", ".")
    .option("--dry-run", "print the plan; send nothing to Meta")
    .description(
      "Compile every flow and sync it to Meta (create/update; flows publish immediately)",
    )
    .action(async (dir: string, opts: { dryRun?: boolean }) => {
      try {
        await pushProject(dir, { dryRun: opts.dryRun });
      } catch (e) {
        reportError(e);
      }
    });

  program
    .command("ids")
    .argument("[dir]", "flows app dir (contains flows.config.ts)", ".")
    .option("--env", "print as WHATSAPP_FLOWS='{...}' (one line, for a .env file)")
    .option("--out <path>", "write a typed TS module (export const WHATSAPP_FLOWS) to <path>")
    .description(
      "Print locked Meta asset ids ({ flows, templates }) for the current env's WABA",
    )
    .action(async (dir: string, opts: { env?: boolean; out?: string }) => {
      try {
        await runIds(dir, { env: opts.env, out: opts.out });
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

// When installed via pnpm (or any tool that symlinks node_modules/.bin), the
// `process.argv[1]` path is the symlink while `import.meta.url` is the realpath.
// Compare realpaths so the CLI runs in that common case.
function isInvokedDirectly(): boolean {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}
if (isInvokedDirectly()) {
  makeProgram().parseAsync(process.argv);
}
