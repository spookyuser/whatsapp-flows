import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileTemplateFile, isTemplateModule } from "../src/compile-template.ts";
import { hashJson } from "../src/lockfile.ts";
import { loadModule } from "../src/load-module.ts";
import { loadProject } from "../src/project.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const at = (p: string): string => path.join(root, p);

const app = { namePrefix: "acme_", language: "en_US" };
type Comp = Record<string, unknown>;
const byType = (t: { components: Comp[] }, type: string): Comp =>
  t.components.find((c) => c.type === type)!;

describe("template compilation", () => {
  it("compiles a marketing template with header/body/footer/buttons", async () => {
    const t = await compileTemplateFile(at("fixtures/mixed-app/welcome.tsx"), app);
    expect(t.name).toBe("acme_welcome");
    expect(t.language).toBe("en_US");
    expect(t.category).toBe("MARKETING");
    expect(t.payload.allow_category_change).toBe(false);

    // Header numbers its own variables: {{1}} with a flat header_text example.
    expect(byType(t, "HEADER")).toEqual({
      type: "HEADER",
      format: "TEXT",
      text: "Welcome to Acme, {{1}}",
      example: { header_text: ["Sam"] },
    });

    // Body numbers independently; two distinct vars -> one example row.
    expect(byType(t, "BODY")).toEqual({
      type: "BODY",
      text: "Hey {{1}}, you're user #{{2}}. Thanks for joining.",
      example: { body_text: [["Sam", "42"]] },
    });

    expect(byType(t, "FOOTER")).toEqual({ type: "FOOTER", text: "Reply STOP to unsubscribe" });

    expect(byType(t, "BUTTONS").buttons).toEqual([
      { type: "URL", text: "Open Acme", url: "https://acme.com/welcome" },
      { type: "QUICK_REPLY", text: "Not now" },
    ]);
  });

  it("carries a variable into a URL button and fills its example", async () => {
    const t = await compileTemplateFile(at("fixtures/mixed-app/order-update.tsx"), app);
    expect(t.name).toBe("acme_order_update");
    expect(t.category).toBe("UTILITY");

    expect(byType(t, "BODY")).toEqual({
      type: "BODY",
      text: "Order {{1}} is on its way and should arrive by {{2}}.",
      example: { body_text: [["A1234", "5pm"]] },
    });

    expect(byType(t, "BUTTONS").buttons).toEqual([
      {
        type: "URL",
        text: "Track order",
        url: "https://acme.com/track/{{1}}",
        example: ["https://acme.com/track/A1234"],
      },
    ]);
  });

  it("produces a stable content hash across recompiles", async () => {
    const a = await compileTemplateFile(at("fixtures/mixed-app/welcome.tsx"), app);
    const b = await compileTemplateFile(at("fixtures/mixed-app/welcome.tsx"), app);
    expect(hashJson(a.payload)).toBe(hashJson(b.payload));
  });
});

describe("template classification", () => {
  it("distinguishes templates from flows by the `template` export", async () => {
    const tpl = await loadModule(at("fixtures/mixed-app/welcome.tsx"));
    const flow = await loadModule(at("fixtures/mixed-app/ping.tsx"));
    expect(isTemplateModule(tpl)).toBe(true);
    expect(isTemplateModule(flow)).toBe(false);
  });

  it("discovers every .tsx in a mixed app", async () => {
    const project = await loadProject(at("fixtures/mixed-app"));
    expect(project.flowFiles.map((f) => path.basename(f))).toEqual([
      "order-update.tsx",
      "ping.tsx",
      "welcome.tsx",
    ]);
  });
});

describe("template validation", () => {
  const expectReject = (file: string, re: RegExp) =>
    expect(compileTemplateFile(at(file), app)).rejects.toThrow(re);

  it("rejects a variable in the footer", () =>
    expectReject("fixtures/template-errors/footer-var.tsx", /footer.*can't contain variables/i));

  it("rejects a variable with an empty example", () =>
    expectReject("fixtures/template-errors/empty-example.tsx", /needs a non-empty example/i));

  it("rejects a URL variable that isn't at the end", () =>
    expectReject(
      "fixtures/template-errors/url-var-not-last.tsx",
      /must be at the end of the URL/i,
    ));

  it("rejects a template without a body", () =>
    expectReject("fixtures/template-errors/no-body.tsx", /exactly one <Template\.Body>/i));
});
