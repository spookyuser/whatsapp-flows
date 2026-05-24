import { describe, expect, it } from "vitest";
import path from "node:path";
import { buildRoutes, fileToRoute } from "../src/routes.ts";

describe("fileToRoute", () => {
  it("maps screen files to routes", () => {
    expect(fileToRoute("index.tsx")).toBe("/");
    expect(fileToRoute("preferences.tsx")).toBe("/preferences");
    expect(fileToRoute("order/edit.tsx")).toBe("/order/edit");
    expect(fileToRoute("order/index.tsx")).toBe("/order");
  });
});

describe("buildRoutes", () => {
  const dir = path.join("/flows", "x", "screens");

  it("builds a route table with stable ids", () => {
    const files = ["confirm.tsx", "index.tsx", "preferences.tsx"].map((f) => path.join(dir, f));
    const routes = buildRoutes(files, dir);
    expect(routes.map((r) => [r.route, r.id])).toEqual([
      ["/confirm", "CONFIRM"],
      ["/", "START"],
      ["/preferences", "PREFERENCES"],
    ]);
  });

  it("rejects two files mapping to the same route", () => {
    const files = [path.join(dir, "index.tsx"), path.join(dir, "index.jsx")];
    expect(() => buildRoutes(files, dir)).toThrow(/same route "\/"/);
  });
});
