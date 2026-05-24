import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFlow } from "../src/build.ts";
import { renderInspect } from "../src/inspect.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const at = (p: string): string => path.join(root, p);

describe("compileFlow (end-to-end)", () => {
  it("compiles the grocery example with the expected routing model", async () => {
    const r = await compileFlow(at("examples/grocery-order"));
    expect(r.flow.version).toBe("7.2");
    expect(r.flow.data_api_version).toBeUndefined();
    expect(r.flow.routing_model).toEqual({
      START: ["PREFERENCES"],
      PREFERENCES: ["CONFIRM"],
      CONFIRM: [],
    });
    expect(r.flow.screens.map((s) => s.id)).toEqual([
      "START",
      "PREFERENCES",
      "CONFIRM",
    ]);
    expect(r.flow).toMatchSnapshot();
  });

  it("emits no JSX/React artifacts", async () => {
    const r = await compileFlow(at("examples/grocery-order"));
    const json = JSON.stringify(r.flow);
    for (const artifact of ["$kind", "flow-node", "#text", "#fragment"]) {
      expect(json).not.toContain(artifact);
    }
  });

  it("emits data_api_version and folds the action into a data_exchange payload", async () => {
    const r = await compileFlow(at("fixtures/dynamic-data-exchange"));
    expect(r.flow.data_api_version).toBe("3.0");
    expect(r.flow.routing_model).toEqual({ START: ["SLOTS"], SLOTS: [] });
    const form = r.flow.screens[0]!.layout.children[0] as { children: unknown[] };
    const footer = form.children.at(-1) as { "on-click-action": unknown };
    expect(footer["on-click-action"]).toEqual({
      name: "data_exchange",
      payload: { action: "lookupSlots", postcode: "${form.postcode}" },
    });
    expect(r.flow).toMatchSnapshot();
  });

  it("compiles the basic lead form", async () => {
    const r = await compileFlow(at("fixtures/basic-lead-form"));
    expect(r.flow.routing_model).toEqual({ START: ["THANKS"], THANKS: [] });
    expect(r.flow).toMatchSnapshot();
  });

  it("base64-encodes local image sources at compile time", async () => {
    const PNG_B64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const r = await compileFlow(at("fixtures/local-image"));
    const form = r.flow.screens[0]!.layout.children[0] as { children: unknown[] };
    const image = form.children[0] as { type: string; src: string };
    expect(image.type).toBe("Image");
    expect(image.src).toBe(PNG_B64);
    const carousel = form.children[1] as { type: string; images: { src: string }[] };
    expect(carousel.type).toBe("ImageCarousel");
    expect(carousel.images[0]!.src).toBe(PNG_B64);
  });

  it("renders an inspect report", async () => {
    const r = await compileFlow(at("examples/grocery-order"));
    const report = renderInspect(r);
    expect(report).toContain("Routes:");
    expect(report).toContain("Transitions:");
    expect(report).toContain("PREFERENCES");
  });

  it("fails with a readable error on a missing route", async () => {
    await expect(compileFlow(at("fixtures/invalid-missing-route"))).rejects.toThrow(
      /no screen exists at "screens\/confirm.tsx"/,
    );
  });

  it("fails on duplicate field names", async () => {
    await expect(
      compileFlow(at("fixtures/invalid-duplicate-fields")),
    ).rejects.toThrow(/more than one field named "email"/);
  });

  it("fails on unsupported components", async () => {
    await expect(
      compileFlow(at("fixtures/invalid-unsupported-component")),
    ).rejects.toThrow(/Raw element <div>/);
  });
});
