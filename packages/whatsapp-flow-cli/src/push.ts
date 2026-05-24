import { FlowCompileError } from "whatsapp-flow-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import { hashFlow, readLock, writeLock } from "./lockfile.ts";
import { createFlow, findFlowByName, getToken, publishFlow, uploadFlowJson } from "./meta.ts";
import { loadProject } from "./project.ts";
import { type CompiledFlow, compileFlowFile } from "./single-file.ts";

function warn(file: string, warnings: string[]): void {
  for (const w of warnings) console.warn(`warning: ${path.basename(file)}: ${w}`);
}

async function compileAll(flowsDir: string): Promise<{ app: FlowsAppConfig; dir: string; flows: CompiledFlow[] }> {
  const project = await loadProject(flowsDir);
  const flows: CompiledFlow[] = [];
  for (const file of project.flowFiles) {
    const c = await compileFlowFile(file, project.app);
    warn(file, c.warnings);
    flows.push(c);
  }
  return { app: project.app, dir: project.dir, flows };
}

/** Validate every flow in the project. */
export async function checkProject(flowsDir: string): Promise<void> {
  const { flows } = await compileAll(flowsDir);
  for (const f of flows) console.log(`✓ ${f.name}: ${f.flow.screens.length} screen(s)`);
  console.log(`✓ ${flows.length} flow(s) valid`);
}

/** Compile every flow to <flows>/.build/<name>.json (for inspection). */
export async function buildProject(flowsDir: string, outDir?: string): Promise<void> {
  const { dir, flows } = await compileAll(flowsDir);
  const out = outDir ? path.resolve(outDir) : path.join(dir, ".build");
  await mkdir(out, { recursive: true });
  for (const f of flows) {
    const dest = path.join(out, `${f.name}.json`);
    await writeFile(dest, JSON.stringify(f.flow, null, 2) + "\n", "utf8");
    console.log(`✓ ${f.name} → ${path.relative(process.cwd(), dest)} (${f.flow.screens.length} screen(s))`);
  }
}

/** Print a compact outline of every flow in the project. */
export async function inspectProject(flowsDir: string): Promise<void> {
  const { flows } = await compileAll(flowsDir);
  for (const f of flows) {
    console.log(`\n${f.name}  (v${f.flow.version}${f.categories ? `, ${f.categories.join("/")}` : ""})`);
    for (const s of f.flow.screens) {
      const flags = [s.terminal ? "terminal" : "", s.success ? "success" : ""].filter(Boolean).join(" ");
      console.log(`  ${s.id}  "${s.title ?? ""}"${flags ? `  [${flags}]` : ""}`);
    }
    const model = f.flow.routing_model ?? {};
    const edges = Object.entries(model).filter(([, t]) => (t as string[]).length > 0);
    if (edges.length > 0) {
      console.log("  transitions:");
      for (const [from, to] of edges) console.log(`    ${from} → ${(to as string[]).join(", ")}`);
    }
  }
}

export interface PushOptions {
  waba?: string;
  publish?: boolean;
  dryRun?: boolean;
}

interface Target {
  label: string;
  id: string;
}

function resolveTargets(app: FlowsAppConfig, wabaArg: string | undefined): Target[] {
  const wabas = app.wabas ?? {};
  const labels = Object.keys(wabas);
  const pick = wabaArg ?? app.defaultWaba ?? (labels.includes("dev") ? "dev" : labels[0]);
  if (!pick) {
    throw new FlowCompileError(
      "No WABA to push to. Add `wabas` + `defaultWaba` to flows.config.ts, or pass --waba <id>.",
    );
  }
  if (pick === "both") {
    if (labels.length === 0) throw new FlowCompileError("--waba both needs `wabas` in flows.config.ts.");
    return labels.map((label) => ({ label, id: wabas[label]!.id }));
  }
  if (wabas[pick]) return [{ label: pick, id: wabas[pick]!.id }];
  if (/^\d+$/.test(pick)) return [{ label: "custom", id: pick }];
  throw new FlowCompileError(
    `Unknown --waba "${pick}". Configured: ${labels.join(", ") || "(none)"}.`,
  );
}

type Action = "skip" | "create" | "update" | "publish";

interface Row {
  waba: string;
  name: string;
  action: Action;
  published: boolean;
  rev?: number;
  id?: string;
}

/** Compile every flow and sync it to Meta: create new drafts, replace changed
 * JSON, skip unchanged. With { publish } each touched flow is also published.
 * { dryRun } prints the plan and writes nothing. */
export async function pushProject(flowsDir: string, opts: PushOptions = {}): Promise<void> {
  const { app, dir, flows } = await compileAll(flowsDir);
  const targets = resolveTargets(app, opts.waba);
  const lock = await readLock(dir);
  const token = opts.dryRun ? "" : getToken(app);

  const rows: Row[] = [];
  for (const target of targets) {
    const wabaLock = (lock.wabas[target.label] ??= {});
    for (const flow of flows) {
      const hash = hashFlow(flow.flow);
      const entry = wabaLock[flow.name];
      const unchanged = !!entry && entry.hash === hash;

      let action: Action;
      let flowId = entry?.id;
      if (unchanged && !opts.publish) {
        action = "skip";
      } else {
        if (!flowId && !opts.dryRun) {
          const existing = await findFlowByName(target.id, flow.name, token);
          if (existing) flowId = existing.id;
        }
        action = !flowId ? "create" : unchanged ? "publish" : "update";
      }

      if (!opts.dryRun && action !== "skip") {
        if (action === "create") {
          flowId = await createFlow(
            target.id,
            { name: flow.name, categories: flow.categories, flow: flow.flow },
            token,
          );
        } else if (action === "update") {
          await uploadFlowJson(flowId!, flow.flow, token);
        }
        if (opts.publish && flowId) await publishFlow(flowId, token);
        const rev = unchanged ? entry!.rev : (entry?.rev ?? 0) + 1;
        wabaLock[flow.name] = { id: flowId!, rev, hash };
      }

      rows.push({
        waba: target.label,
        name: flow.name,
        action,
        published: Boolean(opts.publish) && action !== "skip",
        rev: wabaLock[flow.name]?.rev ?? entry?.rev,
        id: flowId,
      });
    }
  }

  if (!opts.dryRun) await writeLock(dir, lock);
  printSummary(rows, opts);
}

const GLYPH: Record<Action, string> = { skip: "·", create: "+", update: "~", publish: "↑" };

function printSummary(rows: Row[], opts: PushOptions): void {
  const prefix = opts.dryRun ? "(dry run) " : "";
  console.log(`\n${prefix}push summary`);
  const nameW = Math.max(4, ...rows.map((r) => r.name.length));
  const wabaW = Math.max(4, ...rows.map((r) => r.waba.length));
  for (const r of rows) {
    const pub = r.published ? "  PUBLISHED" : "";
    const id = r.id ? `  id ${r.id}` : opts.dryRun && r.action === "create" ? "  id (new)" : "";
    const rev = r.rev !== undefined ? `  rev ${r.rev}` : "";
    console.log(
      `  ${GLYPH[r.action]} ${r.waba.padEnd(wabaW)}  ${r.name.padEnd(nameW)}  ${r.action.padEnd(7)}${rev}${id}${pub}`,
    );
  }
  if (opts.dryRun) console.log("\nNo changes sent to Meta. Re-run without --dry-run to apply.");
}
