import { describe, expect, it } from "vitest";
import { type FlowJson, type ScreenMeta, validateFlow } from "whatsapp-flow-core";

const good: FlowJson = {
  version: "7.2",
  routing_model: { START: ["DONE"], DONE: [] },
  screens: [
    {
      id: "START",
      title: "Start",
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [
              {
                type: "Footer",
                label: "Go",
                "on-click-action": {
                  name: "navigate",
                  next: { type: "screen", name: "DONE" },
                },
              },
            ],
          },
        ],
      },
    },
    {
      id: "DONE",
      title: "Done",
      terminal: true,
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [{ type: "Footer", label: "End", "on-click-action": { name: "complete" } }],
          },
        ],
      },
    },
  ],
};

const meta: ScreenMeta[] = [
  { id: "START", route: "/", terminal: false, completes: false, edgeCount: 1 },
  { id: "DONE", route: "/done", terminal: true, completes: true, edgeCount: 0 },
];

const clone = (): FlowJson => JSON.parse(JSON.stringify(good));

describe("validateFlow", () => {
  it("passes a valid flow without throwing", () => {
    expect(() => validateFlow(good, { screens: meta, start: "START" })).not.toThrow();
  });

  it("flags a transition to a missing screen", () => {
    const bad = clone();
    bad.routing_model = { START: ["NOPE"], DONE: [] };
    expect(() => validateFlow(bad)).toThrow(/transitions to "NOPE", which does not exist/);
  });

  it("flags duplicate screen ids", () => {
    const bad = clone();
    bad.screens = [bad.screens[0]!, bad.screens[0]!];
    expect(() => validateFlow(bad)).toThrow(/same id "START"/);
  });

  it("rejects unserializable values", () => {
    const bad = clone() as unknown as {
      screens: { layout: { children: { children: { label: unknown }[] }[] } }[];
    };
    bad.screens[0]!.layout.children[0]!.children[0]!.label = () => {};
    expect(() => validateFlow(bad as unknown as FlowJson)).toThrow();
  });

  it("rejects stray keys via the schema", () => {
    const bad = clone() as unknown as {
      screens: { layout: { children: Record<string, unknown>[] }[] }[];
    };
    bad.screens[0]!.layout.children[0]!.$kind = "flow-node";
    expect(() => validateFlow(bad as unknown as FlowJson)).toThrow();
  });

  it("treats dead-end screens as errors (strict by default)", () => {
    const lonely: ScreenMeta[] = [
      { id: "START", route: "/", terminal: false, completes: false, edgeCount: 0 },
      { id: "DONE", route: "/done", terminal: true, completes: true, edgeCount: 0 },
    ];
    expect(() => validateFlow(good, { screens: lonely })).toThrow(/dead end/);
  });
});
