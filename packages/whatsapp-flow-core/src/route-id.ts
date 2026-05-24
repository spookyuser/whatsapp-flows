/** Convert a route path to a stable WhatsApp Flow screen id.
 *
 *   "/"            -> "START"
 *   "/preferences" -> "PREFERENCES"
 *   "/order/edit"  -> "ORDER_EDIT"
 *   "confirm"      -> "CONFIRM"   (leading slash optional)
 *
 * The mapping is deterministic and pure so it can be used both at compile time
 * (the CLI router) and at authoring time (the screenData ref helper).
 */
export function routeToScreenId(route: string): string {
  let path = route.trim();
  if (!path.startsWith("/")) path = "/" + path;
  // collapse duplicate slashes and trim trailing slash (except root)
  path = path.replace(/\/+/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/") return "START";
  const id = path
    .slice(1)
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return id.length > 0 ? id : "START";
}

/** Normalize a user-provided route to its canonical "/..." form. */
export function normalizeRoute(route: string): string {
  let path = route.trim();
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/\/+/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}
