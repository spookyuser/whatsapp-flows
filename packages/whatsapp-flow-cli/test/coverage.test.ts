import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type FlowComponent, type FlowJson, LEAF_SPECS, verifyFlowJson } from "whatsapp-flow-core";
import { compileFlowFile } from "../src/single-file.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const at = (p: string): string => path.join(root, p);

const ALL_FLOWS = [
  "examples/grocery-order/grocery.tsx",
  "fixtures/all-components.tsx",
  "fixtures/dynamic-data-exchange.tsx",
];

function collectTypes(components: FlowComponent[], out: Set<string>): void {
  for (const c of components) {
    out.add(c.type);
    const rec = c as Record<string, unknown>;
    if (Array.isArray(rec.children)) collectTypes(rec.children as FlowComponent[], out);
    if (Array.isArray(rec.then)) collectTypes(rec.then as FlowComponent[], out);
    if (Array.isArray(rec.else)) collectTypes(rec.else as FlowComponent[], out);
    if (rec.cases && typeof rec.cases === "object") {
      for (const arr of Object.values(rec.cases as Record<string, FlowComponent[]>)) {
        collectTypes(arr, out);
      }
    }
  }
}

describe("formal verification across all flows", () => {
  for (const file of ALL_FLOWS) {
    it(`${file} compiles and passes the JSON Schema`, async () => {
      const { flow } = await compileFlowFile(at(file));
      const verdict = verifyFlowJson(flow);
      expect(verdict.errors).toEqual([]);
      expect(verdict.valid).toBe(true);
    });
  }
});

describe("component coverage", () => {
  it("the all-components fixture exercises every supported component", async () => {
    const { flow } = await compileFlowFile(at("fixtures/all-components.tsx"));
    const seen = new Set<string>();
    for (const screen of flow.screens) collectTypes(screen.layout.children, seen);

    const expected = [
      ...LEAF_SPECS.map((s) => s.type),
      "Form",
      "Footer",
      "If",
      "Switch",
      "NavigationList",
    ];
    const missing = expected.filter((t) => !seen.has(t));
    expect(missing).toEqual([]);
  });

  it("produces a stable snapshot for the all-components flow", async () => {
    const { flow } = await compileFlowFile(at("fixtures/all-components.tsx"));
    expect(flow as FlowJson).toMatchSnapshot();
  });
});
