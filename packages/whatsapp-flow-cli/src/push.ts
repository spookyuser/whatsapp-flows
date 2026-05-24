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
    if (labels.length === 0)
      throw new FlowCompileError("--waba both needs `wabas` in flows.config.ts.");
    return labels.map((label) => ({ label, id: wabas[label]!.id }));
  }
  if (wabas[pick]) return [{ label: pick, id: wabas[pick]!.id }];
  if (/^\d+$/.test(pick)) return [{ label: "custom", id: pick }];
  throw new FlowCompileError(
    `Unknown --waba "${pick}". Configured: ${labels.join(", ") || "(none)"}.`,
  );
}

type Action = "skip" | "create" | "update" | "edit" | "publish";

interface Row {
  waba: string;
  kind: "flow" | "template";
  name: string;
  action: Action;
  published: boolean;
  rev?: number;
  id?: string;
  status?: string;
}

/** Compile every flow and template and sync each to Meta. Flows: create new
 * drafts, replace changed JSON, skip unchanged (and publish with { publish }).
 * Templates: create when absent (submitting for review), edit when changed,
 * skip unchanged. { dryRun } prints the plan and writes nothing. */
export async function pushProject(flowsDir: string, opts: PushOptions = {}): Promise<void> {
  const { app, dir, flows, templates } = await compileAll(flowsDir);
  const targets = resolveTargets(app, opts.waba);
  const lock = await readLock(dir);
  const token = opts.dryRun ? "" : getToken();

  const rows: Row[] = [];
  for (const target of targets) {
    const wabaLock = (lock.wabas[target.label] ??= {});

    for (const flow of flows) {
      const hash = hashJson(flow.flow);
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
        wabaLock[flow.name] = { id: flowId!, rev, hash, kind: "flow" };
      }

      rows.push({
        waba: target.label,
        kind: "flow",
        name: flow.name,
        action,
        published: Boolean(opts.publish) && action !== "skip",
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
          const existing = await findTemplateByName(target.id, tpl.name, tpl.language, token);
          if (existing) {
            id = existing.id;
            status = existing.status;
          }
        }
        action = !id ? "create" : "edit";
      }

      if (!opts.dryRun && action !== "skip") {
        if (action === "create") {
          const res = await createTemplate(target.id, tpl.payload, token);
          id = res.id;
          status = res.status ?? "PENDING";
        } else if (action === "edit") {
          await editTemplate(id!, tpl.components, token);
          status = "PENDING";
        }
        const rev = unchanged ? entry!.rev : (entry?.rev ?? 0) + 1;
        wabaLock[key] = { id: id!, rev, hash, kind: "template", status };
      }

      rows.push({
        waba: target.label,
        kind: "template",
        name: `${tpl.name} (${tpl.language})`,
        action,
        published: false,
        rev: wabaLock[key]?.rev ?? entry?.rev,
        id,
        status,
      });
    }
  }

  if (!opts.dryRun) await writeLock(dir, lock);
  if (opts.publish && templates.length > 0) {
    console.log("note: --publish applies to flows only; templates go live through Meta review.");
  }
  printSummary(rows, opts);
}

const GLYPH: Record<Action, string> = {
  skip: "·",
  create: "+",
  update: "~",
  edit: "✎",
  publish: "↑",
};

function printSummary(rows: Row[], opts: PushOptions): void {
  const prefix = opts.dryRun ? "(dry run) " : "";
  console.log(`\n${prefix}push summary`);
  const nameW = Math.max(4, ...rows.map((r) => r.name.length));
  const wabaW = Math.max(4, ...rows.map((r) => r.waba.length));
  for (const r of rows) {
    const tail =
      r.kind === "template"
        ? `${r.status ? `  ${r.status}` : ""}${r.id ? `  id ${r.id}` : opts.dryRun && r.action === "create" ? "  id (new)" : ""}`
        : `${r.rev !== undefined ? `  rev ${r.rev}` : ""}${r.id ? `  id ${r.id}` : opts.dryRun && r.action === "create" ? "  id (new)" : ""}${r.published ? "  PUBLISHED" : ""}`;
    console.log(
      `  ${GLYPH[r.action]} ${r.waba.padEnd(wabaW)}  ${r.kind.padEnd(8)}  ${r.name.padEnd(nameW)}  ${r.action.padEnd(7)}${tail}`,
    );
  }
  if (opts.dryRun) console.log("\nNo changes sent to Meta. Re-run without --dry-run to apply.");
}
