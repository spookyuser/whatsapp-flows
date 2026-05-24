import { FlowCompileError } from "whatsapp-flow-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import {
  type CompiledTemplate,
  compileTemplateFile,
  isTemplateModule,
  renderTemplatePreview,
} from "./compile-template.ts";
import { buildIdMap, renderModule } from "./ids.ts";
import { hashJson, readLock, writeLock } from "./lockfile.ts";
import { loadModule } from "./load-module.ts";
import {
  createFlow,
  createTemplate,
  editTemplate,
  findFlowByName,
  findTemplateByName,
  getToken,
  publishFlow,
  uploadFlowJson,
} from "./meta.ts";
import { loadProject } from "./project.ts";
import { type CompiledFlow, compileFlowFile } from "./single-file.ts";

interface CompiledApp {
  app: FlowsAppConfig;
  dir: string;
  flows: CompiledFlow[];
  templates: CompiledTemplate[];
}

const DEFAULT_IDS_FILE = "whatsapp-flows.generated.ts";

/** Compile every asset in the project, classifying each `.tsx` as a flow or a
 * message template (the latter export `template`). The module is loaded once. */
async function compileAll(flowsDir: string): Promise<CompiledApp> {
  const project = await loadProject(flowsDir);
  const flows: CompiledFlow[] = [];
  const templates: CompiledTemplate[] = [];
  for (const file of project.flowFiles) {
    const mod = await loadModule(file);
    if (isTemplateModule(mod)) {
      templates.push(await compileTemplateFile(file, project.app, mod));
    } else {
      flows.push(await compileFlowFile(file, project.app, mod));
    }
  }
  return { app: project.app, dir: project.dir, flows, templates };
}

function countLine(flows: CompiledFlow[], templates: CompiledTemplate[]): string {
  const parts: string[] = [];
  if (flows.length) parts.push(`${flows.length} flow(s)`);
  if (templates.length) parts.push(`${templates.length} template(s)`);
  return parts.join(", ") || "0 assets";
}

/** Validate every flow and template in the project. */
export async function checkProject(flowsDir: string): Promise<void> {
  const { flows, templates } = await compileAll(flowsDir);
  for (const f of flows) console.log(`✓ ${f.name}: ${f.flow.screens.length} screen(s)`);
  for (const t of templates) console.log(`✓ ${t.name}: template (${t.language}, ${t.category})`);
  console.log(`✓ ${countLine(flows, templates)} valid`);
}

/** Compile every asset to <flows>/.build/ (flows as <name>.json, templates as
 * <name>.template.json) for inspection. */
export async function buildProject(flowsDir: string, outDir?: string): Promise<void> {
  const { dir, flows, templates } = await compileAll(flowsDir);
  const out = outDir ? path.resolve(outDir) : path.join(dir, ".build");
  await mkdir(out, { recursive: true });
  for (const f of flows) {
    const dest = path.join(out, `${f.name}.json`);
    await writeFile(dest, JSON.stringify(f.flow, null, 2) + "\n", "utf8");
    console.log(
      `✓ ${f.name} → ${path.relative(process.cwd(), dest)} (${f.flow.screens.length} screen(s))`,
    );
  }
  for (const t of templates) {
    const dest = path.join(out, `${t.name}.template.json`);
    await writeFile(dest, JSON.stringify(t.payload, null, 2) + "\n", "utf8");
    console.log(`✓ ${t.name} → ${path.relative(process.cwd(), dest)} (template)`);
  }
}

/** Print a compact outline of every flow and template in the project. */
export async function inspectProject(flowsDir: string): Promise<void> {
  const { flows, templates } = await compileAll(flowsDir);
  for (const f of flows) {
    console.log(
      `\n${f.name}  (v${f.flow.version}${f.categories ? `, ${f.categories.join("/")}` : ""})`,
    );
    for (const s of f.flow.screens) {
      const flags = [s.terminal ? "terminal" : "", s.success ? "success" : ""]
        .filter(Boolean)
        .join(" ");
      console.log(`  ${s.id}  "${s.title ?? ""}"${flags ? `  [${flags}]` : ""}`);
    }
    const model = f.flow.routing_model ?? {};
    const edges = Object.entries(model).filter(([, t]) => (t as string[]).length > 0);
    if (edges.length > 0) {
      console.log("  transitions:");
      for (const [from, to] of edges) console.log(`    ${from} → ${(to as string[]).join(", ")}`);
    }
  }
  for (const t of templates) {
    for (const line of renderTemplatePreview(t)) console.log(line);
  }
}

export interface PushOptions {
  dryRun?: boolean;
}

/** Pull the single WABA id out of the loaded config; error clearly if unset. */
function resolveWabaId(app: FlowsAppConfig): string {
  const id = app.waba?.id?.trim();
  if (!id) {
    throw new FlowCompileError(
      "No WABA id. Set `waba: { id: process.env.WHATSAPP_WABA_ID! }` in flows.config.ts " +
        "and export WHATSAPP_WABA_ID in your env file (e.g. .env.local).",
    );
  }
  return id;
}

type Action = "skip" | "create" | "update" | "edit";

interface Row {
  kind: "flow" | "template";
  name: string;
  action: Action;
  published: boolean;
  rev?: number;
  id?: string;
  status?: string;
}

/** Compile every flow and template and sync each to Meta. Flows: create new
 * (auto-published), replace changed JSON (then re-publish), skip unchanged.
 * Templates: create when absent (submitting for review), edit when changed,
 * skip unchanged. After a successful sync, write the typed ids module next to
 * flows.config.ts. { dryRun } prints the plan and writes nothing. */
export async function pushProject(flowsDir: string, opts: PushOptions = {}): Promise<void> {
  const { app, dir, flows, templates } = await compileAll(flowsDir);
  const wabaId = resolveWabaId(app);
  const lock = await readLock(dir);
  const token = opts.dryRun ? "" : getToken();

  const wabaLock = (lock.wabas[wabaId] ??= {});
  const rows: Row[] = [];

  for (const flow of flows) {
    const hash = hashJson(flow.flow);
    const entry = wabaLock[flow.name];
    const unchanged = !!entry && entry.hash === hash;

    let action: Action;
    let flowId = entry?.id;
    if (unchanged) {
      action = "skip";
    } else {
      if (!flowId && !opts.dryRun) {
        const existing = await findFlowByName(wabaId, flow.name, token);
        if (existing) flowId = existing.id;
      }
      action = !flowId ? "create" : "update";
    }

    if (!opts.dryRun && action !== "skip") {
      if (action === "create") {
        flowId = await createFlow(
          wabaId,
          { name: flow.name, categories: flow.categories, flow: flow.flow },
          token,
        );
      } else if (action === "update") {
        await uploadFlowJson(flowId!, flow.flow, token);
      }
      await publishFlow(flowId!, token);
      const rev = (entry?.rev ?? 0) + 1;
      wabaLock[flow.name] = { id: flowId!, rev, hash, kind: "flow" };
    }

    rows.push({
      kind: "flow",
      name: flow.name,
      action,
      published: action !== "skip",
      rev: wabaLock[flow.name]?.rev ?? entry?.rev,
      id: flowId,
    });
  }

  for (const tpl of templates) {
    const key = `tpl:${tpl.name}@${tpl.language}`;
    const hash = hashJson(tpl.payload);
    const entry = wabaLock[key];
    const unchanged = !!entry && entry.hash === hash;

    let action: Action;
    let id = entry?.id;
    let status = entry?.status;
    if (unchanged) {
      action = "skip";
    } else {
      if (!id && !opts.dryRun) {
        const existing = await findTemplateByName(wabaId, tpl.name, tpl.language, token);
        if (existing) {
          id = existing.id;
          status = existing.status;
        }
      }
      action = !id ? "create" : "edit";
    }

    if (!opts.dryRun && action !== "skip") {
      if (action === "create") {
        const res = await createTemplate(wabaId, tpl.payload, token);
        id = res.id;
        status = res.status ?? "PENDING";
      } else if (action === "edit") {
        await editTemplate(id!, tpl.components, token);
        status = "PENDING";
      }
      const rev = (entry?.rev ?? 0) + 1;
      wabaLock[key] = { id: id!, rev, hash, kind: "template", status };
    }

    rows.push({
      kind: "template",
      name: `${tpl.name} (${tpl.language})`,
      action,
      published: false,
      rev: wabaLock[key]?.rev ?? entry?.rev,
      id,
      status,
    });
  }

  if (!opts.dryRun) {
    await writeLock(dir, lock);
    await writeIdsModule(dir, app, wabaId, wabaLock);
  }
  printSummary(rows, wabaId, opts);
}

async function writeIdsModule(
  dir: string,
  app: FlowsAppConfig,
  wabaId: string,
  section: Record<string, import("./lockfile.ts").LockEntry>,
): Promise<void> {
  const relPath = app.generatedIdsPath ?? DEFAULT_IDS_FILE;
  const dest = path.isAbsolute(relPath) ? relPath : path.resolve(dir, relPath);
  await mkdir(path.dirname(dest), { recursive: true });
  const map = buildIdMap(section);
  await writeFile(dest, renderModule(map, wabaId), "utf8");
  console.log(`✓ Wrote ids → ${path.relative(process.cwd(), dest)}`);
}

const GLYPH: Record<Action, string> = {
  skip: "·",
  create: "+",
  update: "~",
  edit: "✎",
};

function printSummary(rows: Row[], wabaId: string, opts: PushOptions): void {
  const prefix = opts.dryRun ? "(dry run) " : "";
  console.log(`\n${prefix}push summary — WABA ${wabaId}`);
  const nameW = Math.max(4, ...rows.map((r) => r.name.length));
  for (const r of rows) {
    const tail =
      r.kind === "template"
        ? `${r.status ? `  ${r.status}` : ""}${r.id ? `  id ${r.id}` : opts.dryRun && r.action === "create" ? "  id (new)" : ""}`
        : `${r.rev !== undefined ? `  rev ${r.rev}` : ""}${r.id ? `  id ${r.id}` : opts.dryRun && r.action === "create" ? "  id (new)" : ""}${r.published ? "  LIVE" : ""}`;
    console.log(
      `  ${GLYPH[r.action]} ${r.kind.padEnd(8)}  ${r.name.padEnd(nameW)}  ${r.action.padEnd(7)}${tail}`,
    );
  }
  if (opts.dryRun) console.log("\nNo changes sent to Meta. Re-run without --dry-run to apply.");
}
