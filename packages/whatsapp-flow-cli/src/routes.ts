import { FlowCompileError, normalizeRoute, routeToScreenId } from "whatsapp-flow-core";
import path from "node:path";

export interface RouteEntry {
  /** Absolute path to the screen file. */
  file: string;
  /** Relative path under screens/, e.g. "preferences.tsx". */
  rel: string;
  /** Canonical route, e.g. "/preferences". */
  route: string;
  /** Generated screen id, e.g. "PREFERENCES". */
  id: string;
}

/** Map a screen file (relative to screens/) to its route. */
export function fileToRoute(rel: string): string {
  let r = rel.replace(/\\/g, "/").replace(/\.(tsx|jsx)$/, "");
  const parts = r.split("/");
  if (parts[parts.length - 1] === "index") parts.pop();
  r = "/" + parts.join("/");
  return normalizeRoute(r);
}

/** Build the route table from discovered screen files, checking for collisions. */
export function buildRoutes(files: string[], screensDir: string): RouteEntry[] {
  const entries: RouteEntry[] = [];
  const byRoute = new Map<string, string>();
  const byId = new Map<string, string>();

  for (const file of files) {
    const rel = path.relative(screensDir, file);
    const route = fileToRoute(rel);
    const id = routeToScreenId(route);

    const existingRoute = byRoute.get(route);
    if (existingRoute) {
      throw new FlowCompileError(
        `Two screen files map to the same route "${route}": "${existingRoute}" and "${rel}".`,
      );
    }
    const existingId = byId.get(id);
    if (existingId) {
      throw new FlowCompileError(
        `Screen files "${existingId}" and "${rel}" both generate screen id "${id}".`,
      );
    }
    byRoute.set(route, rel);
    byId.set(id, rel);
    entries.push({ file, rel, route, id });
  }

  return entries;
}
