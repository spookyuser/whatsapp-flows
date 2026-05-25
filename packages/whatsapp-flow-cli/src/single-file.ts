import {
  assembleFlow,
  FlowCompileError,
  type FlowJson,
  normalizeRoute,
  normalizeScreen,
  type NormalizedScreen,
  routeToScreenId,
  type ScreenMeta,
  validateFlow,
} from "whatsapp-flow-core";
import path from "node:path";
import type { FlowConfig, FlowsAppConfig } from "whatsapp-flow-tsx";
import { resolveImages } from "./images.ts";
import { loadModule } from "./load-module.ts";

export interface CompiledFlow {
  /** Meta flow asset name. */
  name: string;
  categories?: string[];
  flow: FlowJson;
  /** Absolute path to the source .tsx file. */
  file: string;
}

const DEFAULT_VERSION = "7.3";

/** Compile a single-file flow: one `.tsx` module that exports `flow` (config)
 * plus one PascalCase function per screen. The export named `Index` is the
 * start screen at route "/"; every other export routes to "/<kebab-of-export-name>". */
export async function compileFlowFile(
  file: string,
  app: Pick<FlowsAppConfig, "version"> = {},
  preloaded?: Record<string, unknown>,
): Promise<CompiledFlow> {
  const mod = preloaded ?? (await loadModule(file));
  const cfg = (mod.flow ?? {}) as FlowConfig;

  const version = cfg.version ?? app.version ?? DEFAULT_VERSION;
  const categories = cfg.categories;
  const name = cfg.name ?? fileToFlowName(file);

  // Screen exports: PascalCase function exports (excludes `flow` and helpers).
  const screenExports = Object.entries(mod).filter(
    ([key, value]) => typeof value === "function" && /^[A-Z]/.test(key),
  ) as [string, () => unknown][];
  if (!screenExports.some(([n]) => n === "Index")) {
    const have = screenExports.map(([n]) => n).join(", ") || "(none)";
    throw new FlowCompileError(
      `Flow "${path.basename(file)}" must export an \`Index\` function — that's the start screen at "/". Found: ${have}.`,
    );
  }

  // Build the route table from export names.
  const routes = screenExports.map(([exportName, render]) => {
    const route = exportName === "Index" ? "/" : "/" + kebab(exportName);
    return { exportName, render, route, id: routeToScreenId(route) };
  });
  assertUnique(routes, file);

  const idByRoute = new Map(routes.map((r) => [r.route, r.id]));
  const resolveRoute = (to: string): string | null => idByRoute.get(normalizeRoute(to)) ?? null;

  const baseDir = path.dirname(file);
  const startId = "START";

  const normalized: NormalizedScreen[] = [];
  const metas: ScreenMeta[] = [];
  for (const entry of routes) {
    let root: unknown;
    try {
      root = entry.render();
    } catch (e) {
      if (e instanceof FlowCompileError) throw e;
      throw new FlowCompileError(
        `Screen "${entry.exportName}" in ${path.basename(file)} threw while rendering: ${(e as Error).message}`,
        { route: entry.route },
      );
    }
    await resolveImages(root, baseDir, entry.route);
    const ns = normalizeScreen(root, {
      route: entry.route,
      id: entry.id,
      resolveRoute,
    });
    normalized.push(ns);
    metas.push({
      id: entry.id,
      route: entry.route,
      terminal: ns.terminal,
      completes: ns.completes,
      edgeCount: ns.edges.length,
    });
  }

  const ordered = orderFromStart(normalized, startId);
  const flow = assembleFlow(ordered, {
    version,
    dataApiVersion: cfg.dataApiVersion,
    hasEndpoint: Boolean(cfg.endpointUri),
  });

  validateFlow(flow, { screens: metas, start: startId });

  return { name, categories, flow, file };
}

// --- helpers ---------------------------------------------------------------

/** Derive a flow name from a file path: "woolworths-login.tsx" -> "woolworths_login". */
function fileToFlowName(file: string): string {
  return path
    .basename(file)
    .replace(/\.(tsx|jsx)$/, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** "WoolworthsLogin" -> "woolworths-login". */
function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function assertUnique(
  routes: { exportName: string; route: string; id: string }[],
  file: string,
): void {
  const byRoute = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const r of routes) {
    const dupRoute = byRoute.get(r.route);
    if (dupRoute) {
      throw new FlowCompileError(
        `Screens "${dupRoute}" and "${r.exportName}" in ${path.basename(file)} both map to route "${r.route}".`,
      );
    }
    const dupId = byId.get(r.id);
    if (dupId) {
      throw new FlowCompileError(
        `Screens "${dupId}" and "${r.exportName}" in ${path.basename(file)} both generate screen id "${r.id}".`,
      );
    }
    byRoute.set(r.route, r.exportName);
    byId.set(r.id, r.exportName);
  }
}

/** Breadth-first order from the start screen, then any unreachable screens. */
function orderFromStart(normalized: NormalizedScreen[], startId: string): NormalizedScreen[] {
  const byId = new Map(normalized.map((n) => [n.screen.id, n]));
  const ordered: NormalizedScreen[] = [];
  const seen = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    const ns = byId.get(id);
    if (!ns) continue;
    seen.add(id);
    ordered.push(ns);
    for (const edge of ns.edges) if (!seen.has(edge)) queue.push(edge);
  }
  for (const ns of normalized) {
    if (!seen.has(ns.screen.id)) {
      seen.add(ns.screen.id);
      ordered.push(ns);
    }
  }
  return ordered;
}
