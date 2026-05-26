import { listTemplates, type MetaTemplate } from "./meta.ts";
import {
  loadAppConfig,
  resolveEnv,
  resolveProjectDir,
  resolveToken,
  resolveWabaId,
} from "./project.ts";

export interface TemplatesOptions {
  env?: string;
  allEnvs?: boolean;
}

const COLUMNS = ["NAME", "LANG", "CATEGORY", "STATUS", "ID"] as const;

function cells(t: MetaTemplate): string[] {
  return [t.name ?? "", t.language ?? "", t.category ?? "", t.status ?? "", t.id];
}

/** Format one env's live templates as aligned table lines (sorted by name then
 * language). Returns a single `(none)` line when there are no templates. */
export function renderTemplateTable(rows: MetaTemplate[]): string[] {
  if (rows.length === 0) return ["  (none)"];
  const sorted = [...rows].sort(
    (a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "") ||
      (a.language ?? "").localeCompare(b.language ?? ""),
  );
  const matrix = [COLUMNS as readonly string[], ...sorted.map(cells)];
  const widths = COLUMNS.map((_, i) => Math.max(...matrix.map((r) => r[i]!.length)));
  return matrix.map(
    (r) =>
      "  " +
      r
        .map((cell, i) => cell.padEnd(widths[i]!))
        .join("  ")
        .trimEnd(),
  );
}

/** Print live message templates fetched from Meta for the resolved env (default)
 * or every configured env (`--all-envs`). Read-only: needs an access token but
 * touches neither the lockfile nor local flow files. */
export async function runTemplates(flowsDir?: string, opts: TemplatesOptions = {}): Promise<void> {
  const dir = resolveProjectDir(flowsDir);
  const app = await loadAppConfig(dir);
  const envs = opts.allEnvs ? Object.keys(app.wabas ?? {}) : [resolveEnv(app, { env: opts.env })];
  for (const env of envs) {
    const wabaId = resolveWabaId(app, env);
    const token = await resolveToken(app, { env, wabaId });
    const rows = await listTemplates(wabaId, token);
    console.log(`\nenv ${env} (WABA ${wabaId}) — ${rows.length} template(s)`);
    for (const line of renderTemplateTable(rows)) console.log(line);
  }
}
