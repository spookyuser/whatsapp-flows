import {
  assembleFlow,
  FlowCompileError,
  type FlowJson,
  normalizeRoute,
  normalizeScreen,
  type NormalizedScreen,
  routeToFilePath,
  routeToScreenId,
  type ScreenMeta,
  validateFlow,
} from "whatsapp-flow-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig, type ResolvedConfig } from "./config.ts";
import { discoverScreens } from "./discover.ts";
import { resolveImages } from "./images.ts";
import { loadModule } from "./load-module.ts";
import { buildRoutes, type RouteEntry } from "./routes.ts";

export interface CompileResult {
  flow: FlowJson;
  routes: RouteEntry[];
  warnings: string[];
  config: ResolvedConfig;
  startId: string;
}

export async function compileFlow(
  flowDir: string,
  overrides: { out?: string } = {},
): Promise<CompileResult> {
  const config = await loadConfig(flowDir);
  if (overrides.out) config.output = path.resolve(process.cwd(), overrides.out);

  const screensDir = path.join(config.dir, "screens");
  const files = await discoverScreens(screensDir);
  if (files.length === 0) {
    throw new FlowCompileError(`No screen files found in "${screensDir}".`);
  }

  const routes = buildRoutes(files, screensDir);
  const idByRoute = new Map(routes.map((r) => [r.route, r.id]));
  const resolveRoute = (to: string): string | null =>
    idByRoute.get(normalizeRoute(to)) ?? null;

  const startId = routeToScreenId(config.start);
  if (!routes.some((r) => r.id === startId)) {
    throw new FlowCompileError(
      `Start route "${config.start}" has no screen (expected "${routeToFilePath(config.start)}").`,
    );
  }

  const normalized: NormalizedScreen[] = [];
  const metas: ScreenMeta[] = [];
  for (const entry of routes) {
    const mod = await loadModule(entry.file);
    const def = mod.default;
    if (typeof def !== "function") {
      throw new FlowCompileError(
        `Screen "${entry.route}" (${entry.rel}) must \`export default\` a function returning a <Screen>.`,
        { route: entry.route },
      );
    }
    let root: unknown;
    try {
      root = (def as () => unknown)();
    } catch (e) {
      if (e instanceof FlowCompileError) throw e;
      throw new FlowCompileError(
        `Screen "${entry.route}" threw while rendering: ${(e as Error).message}`,
        { route: entry.route },
      );
    }
    // Encode any <Image>/<CarouselImage> (and Option/NavItem image) sources that
    // are file paths or URLs into base64, resolving relative paths against the
    // screen file's directory.
    await resolveImages(root, path.dirname(entry.file), entry.route);
    normalized.push(
      normalizeScreen(root, { route: entry.route, id: entry.id, resolveRoute }),
    );
    const last = normalized[normalized.length - 1]!;
    metas.push({
      id: entry.id,
      route: entry.route,
      terminal: last.terminal,
      completes: last.completes,
      edgeCount: last.edges.length,
    });
  }

  // Order screens breadth-first from the start screen, then any unreachable
  // screens in route order, so the output reads in navigation order.
  const byId = new Map(normalized.map((n) => [n.screen.id, n]));
  const ordered: NormalizedScreen[] = [];
  const seen = new Set<string>();
  const queue: string[] = [startId];
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

  const flow = assembleFlow(ordered, {
    version: config.version,
    dataApiVersion: config.dataApiVersion,
    hasEndpoint: Boolean(config.endpointUri),
  });

  const { warnings } = validateFlow(flow, {
    strict: config.strict,
    screens: metas,
    start: startId,
  });

  return { flow, routes, warnings, config, startId };
}

export async function writeFlow(result: CompileResult): Promise<string> {
  const out = result.config.output;
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(result.flow, null, 2) + "\n", "utf8");
  return out;
}
