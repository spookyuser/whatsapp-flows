import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFlowFile } from "../src/single-file.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const at = (p: string): string => path.join(root, p);

describe("compileFlowFile (end-to-end)", () => {
  it("compiles the grocery example with the expected routing model", async () => {
    const r = await compileFlowFile(at("examples/grocery-order/grocery.tsx"));
    expect(r.flow.version).toBe("7.3");
    expect(r.flow.data_api_version).toBeUndefined();
    expect(r.flow.routing_model).toEqual({
      START: ["PREFERENCES"],
      PREFERENCES: ["CONFIRM"],
      CONFIRM: [],
    });
    expect(r.flow.screens.map((s) => s.id)).toEqual(["START", "PREFERENCES", "CONFIRM"]);
    expect(r.flow).toMatchSnapshot();
  });

  it("emits no JSX/React artifacts", async () => {
    const r = await compileFlowFile(at("examples/grocery-order/grocery.tsx"));
    const json = JSON.stringify(r.flow);
    for (const artifact of ["$kind", "flow-node", "#text", "#fragment"]) {
      expect(json).not.toContain(artifact);
    }
  });

  it("emits data_api_version and folds the action into a data_exchange payload", async () => {
    const r = await compileFlowFile(at("fixtures/dynamic-data-exchange.tsx"));
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

  it("base64-encodes local image sources at compile time", async () => {
    const PNG_B64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const r = await compileFlowFile(at("fixtures/local-image/local-image.tsx"));
    const form = r.flow.screens[0]!.layout.children[0] as { children: unknown[] };
    const image = form.children[0] as { type: string; src: string };
    expect(image.type).toBe("Image");
    expect(image.src).toBe(PNG_B64);
    const carousel = form.children[1] as { type: string; images: { src: string }[] };
    expect(carousel.type).toBe("ImageCarousel");
    expect(carousel.images[0]!.src).toBe(PNG_B64);
  });

  it("fails when no Index export is present", async () => {
    const Other = (): unknown => ({ component: "Screen", props: { title: "x" }, children: [] });
    await expect(compileFlowFile("/tmp/other.tsx", {}, { Other })).rejects.toThrow(
      /must export an `Index` function/,
    );
  });

  it("fails with a readable error on a missing route", async () => {
    await expect(compileFlowFile(at("fixtures/invalid-missing-route.tsx"))).rejects.toThrow(
      /no screen exports that route/,
    );
  });

  it("fails on duplicate field names", async () => {
    await expect(compileFlowFile(at("fixtures/invalid-duplicate-fields.tsx"))).rejects.toThrow(
      /more than one field named "email"/,
    );
  });

  it("fails on unsupported components", async () => {
    await expect(compileFlowFile(at("fixtures/invalid-unsupported-component.tsx"))).rejects.toThrow(
      /Raw element <div>/,
    );
  });
});
