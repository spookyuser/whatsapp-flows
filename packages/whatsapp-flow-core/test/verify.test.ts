import { describe, expect, it } from "vitest";
import { buildFlowJsonSchema, type FlowJson, verifyFlowJson } from "whatsapp-flow-core";

const valid: FlowJson = {
  version: "7.3",
  routing_model: { START: [] },
  screens: [
    {
      id: "START",
      title: "S",
      terminal: true,
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [
              { type: "TextInput", name: "n", label: "N", "input-type": "text" },
              { type: "Footer", label: "Go", "on-click-action": { name: "complete" } },
            ],
          },
        ],
      },
    },
  ],
};

const clone = (): Record<string, Any> => JSON.parse(JSON.stringify(valid));
type Any = Record<string, unknown>;
const firstInput = (f: Record<string, Any>): Any =>
  (((f.screens as Any[])[0]!.layout as Any).children as Any[])[0]!.children[0] as Any;
const footer = (f: Record<string, Any>): Any =>
  (((f.screens as Any[])[0]!.layout as Any).children as Any[])[0]!.children[1] as Any;

describe("formal verification (JSON Schema + Ajv)", () => {
  it("the schema exposes a component union and an action union", () => {
    const s = buildFlowJsonSchema() as Any;
    const defs = s.definitions as Any;
    expect(Array.isArray((defs.component as Any).oneOf)).toBe(true);
    expect(Array.isArray((defs.action as Any).oneOf)).toBe(true);
  });

  it("accepts a valid flow", () => {
    expect(verifyFlowJson(valid)).toEqual({ valid: true, errors: [] });
  });

  it("rejects an invalid enum value", () => {
    const bad = clone();
    firstInput(bad)["input-type"] = "bogus";
    expect(verifyFlowJson(bad).valid).toBe(false);
  });

  it("rejects a stray key (JSX artifact)", () => {
    const bad = clone();
    firstInput(bad).$kind = "flow-node";
    expect(verifyFlowJson(bad).valid).toBe(false);
  });

  it("rejects an unknown action name", () => {
    const bad = clone();
    footer(bad)["on-click-action"] = { name: "frobnicate" };
    expect(verifyFlowJson(bad).valid).toBe(false);
  });

  it("rejects a component missing a required property", () => {
    const bad = clone();
    delete firstInput(bad).label;
    expect(verifyFlowJson(bad).valid).toBe(false);
  });

  it("rejects a non-string value where a string is required", () => {
    const bad = clone();
    firstInput(bad).label = 123;
    const result = verifyFlowJson(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
