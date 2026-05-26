import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Template } from "whatsapp-flow-tsx";
import {
  type CompiledTemplate,
  compileTemplateFile,
  isTemplateModule,
  resolveTemplateFlowRefs,
} from "../src/compile-template.ts";
import { hashJson } from "../src/lockfile.ts";
import { loadModule } from "../src/load-module.ts";
import { loadProject } from "../src/project.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const at = (p: string): string => path.join(root, p);

const app = { language: "en_US" };
type Comp = Record<string, unknown>;
const byType = (t: { components: Comp[] }, type: string): Comp =>
  t.components.find((c) => c.type === type)!;

describe("template compilation", () => {
  it("compiles a marketing template with header/body/footer/buttons", async () => {
    const t = await compileTemplateFile(at("fixtures/mixed-app/welcome.tsx"), app);
    expect(t.name).toBe("welcome");
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
    expect(t.name).toBe("order_update");
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

  it("rejects a navigate flow button without a screen", () =>
    expectReject("fixtures/template-errors/flow-no-screen.tsx", /needs a navigateScreen/i));

  it("rejects a flow button with both flowName and flowId", () =>
    expectReject("fixtures/template-errors/flow-both-refs.tsx", /exactly one of flowName/i));
});

describe("template button surface", () => {
  it("exposes every documented button under the Template namespace", () => {
    // Implemented + stubbed. Removing any of these should fail this test.
    for (const name of [
      "URL",
      "Reply",
      "Phone",
      "Flow",
      "CopyCode",
      "Catalog",
      "OptOut",
      "OtpCopyCode",
      "OtpOneTap",
      "OtpZeroTap",
      "MultiProduct",
      "VoiceCall",
      "App",
    ] as const) {
      expect(typeof Template[name]).toBe("function");
    }
  });
});

describe("template buttons", () => {
  const buttonsOf = (t: { components: Comp[] }): Comp[] => byType(t, "BUTTONS").buttons as Comp[];

  it("compiles copy-code, URL, and opt-out buttons", async () => {
    const t = await compileTemplateFile(at("fixtures/template-buttons/buttons.tsx"), app);
    expect(buttonsOf(t)).toEqual([
      { type: "COPY_CODE", example: "SAVE10" },
      { type: "URL", text: "Shop now", url: "https://acme.com/shop" },
      { type: "MARKETING_OPT_OUT", text: "Stop promotions" },
    ]);
  });

  it("compiles a catalog button with its fixed label", async () => {
    const t = await compileTemplateFile(at("fixtures/template-buttons/catalog.tsx"), app);
    expect(buttonsOf(t)).toEqual([
      { type: "CATALOG", text: "View catalog" },
      { type: "MARKETING_OPT_OUT", text: "No thanks" },
    ]);
  });

  it("compiles a flow button with a raw flow id", async () => {
    const t = await compileTemplateFile(at("fixtures/template-buttons/flow-id.tsx"), app);
    expect(buttonsOf(t)).toEqual([
      {
        type: "FLOW",
        text: "Book now",
        flow_action: "navigate",
        navigate_screen: "WELCOME",
        flow_id: "123456789",
      },
    ]);
    expect(t.flowRefs).toEqual([]);
  });

  it("defers a flow button referenced by name to push-time id resolution", async () => {
    const t = await compileTemplateFile(at("fixtures/template-buttons/flow-name.tsx"), app);
    const button = buttonsOf(t)[0]!;
    expect(button).toEqual({
      type: "FLOW",
      text: "Start survey",
      flow_action: "navigate",
      navigate_screen: "WELCOME",
    });
    expect(button.flow_id).toBeUndefined();
    expect(t.flowRefs).toEqual([{ button, flowName: "survey" }]);
  });

  it("compiles a one-tap OTP button payload", async () => {
    const t = await compileTemplateFile(at("fixtures/template-buttons/otp.tsx"), app);
    expect(buttonsOf(t)).toEqual([
      {
        type: "OTP",
        otp_type: "ONE_TAP",
        package_name: "com.acme.app",
        signature_hash: "K8a83b2c1d",
      },
    ]);
  });

  it("fails to compile stubbed buttons with a uniform 'not implemented' error", async () => {
    for (const [file, type] of [
      ["fixtures/template-buttons/stub-mpm.tsx", "MPM"],
      ["fixtures/template-buttons/stub-voicecall.tsx", "VOICE_CALL"],
      ["fixtures/template-buttons/stub-app.tsx", "APP"],
    ] as const) {
      await expect(compileTemplateFile(at(file), app)).rejects.toThrow(
        new RegExp(`not implemented yet[\\s\\S]*Underlying Meta type: ${type}`, "i"),
      );
    }
  });
});

describe("resolveTemplateFlowRefs", () => {
  const make = (flowName: string): { tpl: CompiledTemplate; button: Comp } => {
    const button: Comp = { type: "FLOW", text: "x", flow_action: "navigate" };
    const tpl = { name: "t", flowRefs: [{ button, flowName }] } as unknown as CompiledTemplate;
    return { tpl, button };
  };

  it("fills flow_id from the resolved per-env flow asset map", () => {
    const { tpl, button } = make("survey");
    resolveTemplateFlowRefs(tpl, { survey: { id: "999" } });
    expect(button.flow_id).toBe("999");
  });

  it("throws when a referenced flow isn't in the app", () => {
    const { tpl } = make("missing");
    expect(() => resolveTemplateFlowRefs(tpl, {})).toThrow(/has no flow named "missing"/i);
  });

  it("leaves the id unresolved in a dry run", () => {
    const { tpl, button } = make("missing");
    resolveTemplateFlowRefs(tpl, {}, { dryRun: true });
    expect(button.flow_id).toBeUndefined();
  });
});
