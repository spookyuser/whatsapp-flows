import { FlowCompileError } from "whatsapp-flow-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import {
  type CompiledTemplate,
  compileTemplateFile,
  isTemplateModule,
  renderTemplatePreview,
  resolveTemplateFlowRefs,
} from "./compile-template.ts";
import { buildAllEnvIdMaps, renderModule } from "./ids.ts";
import { hashJson, type Lockfile, readLock, writeLock } from "./lockfile.ts";
import { loadModule } from "./load-module.ts";
import {
  createFlow,
  createTemplate,
  editTemplate,
  findFlowByName,
  findTemplateByName,
  publishFlow,
  uploadFlowJson,
} from "./meta.ts";
import { loadProject, resolveToken } from "./project.ts";
import { type CompiledFlow, compileFlowFile } from "./single-file.ts";

interface CompiledApp {
  app: FlowsAppConfig;
  dir: string;
  env: string;
  wabaId: string;
  flows: CompiledFlow[];
  templates: CompiledTemplate[];
}

export interface ProjectOptions {
  env?: string;
}

const DEFAULT_IDS_FILE = "whatsapp-flows.generated.ts";

/** Compile every asset in the project, classifying each `.tsx` as a flow or a
 * message template (the latter export `template`). The module is loaded once. */
async function compileAll(flowsDir?: string, opts: ProjectOptions = {}): Promise<CompiledApp> {
  const project = await loadProject(flowsDir, { env: opts.env });
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
  return {
    app: project.app,
    dir: project.dir,
    env: project.env,
    wabaId: project.wabaId,
    flows,
    templates,
  };
}

function countLine(flows: CompiledFlow[], templates: CompiledTemplate[]): string {
  const parts: string[] = [];
  if (flows.length) parts.push(`${flows.length} flow(s)`);
  if (templates.length) parts.push(`${templates.length} template(s)`);
  return parts.join(", ") || "0 assets";
}

/** Validate every flow and template in the project. */
export async function checkProject(flowsDir?: string, opts: ProjectOptions = {}): Promise<void> {
  const { flows, templates } = await compileAll(flowsDir, opts);
  for (const f of flows) console.log(`✓ ${f.name}: ${f.flow.screens.length} screen(s)`);
  for (const t of templates) console.log(`✓ ${t.name}: template (${t.language}, ${t.category})`);
  console.log(`✓ ${countLine(flows, templates)} valid`);
}

/** Compile every asset to <flows>/.build/ (flows as <name>.json, templates as
 * <name>.template.json) for inspection. */
export async function buildProject(
  flowsDir?: string,
  outDir?: string,
  opts: ProjectOptions = {},
): Promise<void> {
  const { dir, flows, templates } = await compileAll(flowsDir, opts);
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
export async function inspectProject(flowsDir?: string, opts: ProjectOptions = {}): Promise<void> {
  const { flows, templates } = await compileAll(flowsDir, opts);
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
  env?: string;
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
export async function pushProject(flowsDir?: string, opts: PushOptions = {}): Promise<void> {
  const { app, dir, env, wabaId, flows, templates } = await compileAll(flowsDir, { env: opts.env });
  const lock = await readLock(dir);
  const token = opts.dryRun ? "" : await resolveToken(app, { env, wabaId });

  const envLock = (lock.envs[env] ??= { wabaId, assets: {} });
  if (envLock.wabaId !== wabaId) {
    throw new FlowCompileError(
      `Lock env "${env}" is pinned to WABA ${envLock.wabaId}, but flows.config.ts now ` +
        `resolves it to ${wabaId}. If you intentionally re-pointed "${env}" at a new WABA, ` +
        "remove that env from flows.lock.json and re-push.",
    );
  }
  const assets = envLock.assets;
  const rows: Row[] = [];

  for (const flow of flows) {
    const hash = hashJson(flow.flow);
    const entry = assets[flow.name];
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
      assets[flow.name] = { id: flowId!, rev, hash, kind: "flow" };
    }

    rows.push({
      kind: "flow",
      name: flow.name,
      action,
      published: action !== "skip",
      rev: assets[flow.name]?.rev ?? entry?.rev,
      id: flowId,
    });
  }

  for (const tpl of templates) {
    const key = `tpl:${tpl.name}@${tpl.language}`;
    resolveTemplateFlowRefs(tpl, assets, { dryRun: opts.dryRun });
    const hash = hashJson(tpl.payload);
    const entry = assets[key];
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
      assets[key] = { id: id!, rev, hash, kind: "template", status };
    }

    rows.push({
      kind: "template",
      name: `${tpl.name} (${tpl.language})`,
      action,
      published: false,
      rev: assets[key]?.rev ?? entry?.rev,
      id,
      status,
    });
  }

  if (!opts.dryRun) {
    await writeLock(dir, lock);
    await writeIdsModule(dir, app, lock);
  }
  printSummary(rows, env, wabaId, opts);
}

async function writeIdsModule(dir: string, app: FlowsAppConfig, lock: Lockfile): Promise<void> {
  const relPath = app.generatedIdsPath ?? DEFAULT_IDS_FILE;
  const dest = path.isAbsolute(relPath) ? relPath : path.resolve(dir, relPath);
  await mkdir(path.dirname(dest), { recursive: true });
  const all = buildAllEnvIdMaps(lock);
  await writeFile(dest, renderModule(all, app.defaultEnv), "utf8");
  console.log(`✓ Wrote ids → ${path.relative(process.cwd(), dest)}`);
}

const GLYPH: Record<Action, string> = {
  skip: "·",
  create: "+",
  update: "~",
  edit: "✎",
};

function printSummary(rows: Row[], env: string, wabaId: string, opts: PushOptions): void {
  const prefix = opts.dryRun ? "(dry run) " : "";
  console.log(`\n${prefix}push summary — env ${env} (WABA ${wabaId})`);
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
