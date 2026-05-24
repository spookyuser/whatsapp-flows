import { describe, expect, it } from "vitest";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import type { Lockfile } from "../src/lockfile.ts";
import { buildIdMap, renderEnvLine, renderModule, resolveLockedWaba } from "../src/ids.ts";

const lock: Lockfile = {
  version: 1,
  wabas: {
    "111": {
      woolworths_login: { id: "100", rev: 1, hash: "a", kind: "flow" },
      legacy_flow: { id: "101", rev: 1, hash: "b" }, // no kind -> flow
      "tpl:acme_welcome@en_US": {
        id: "200",
        rev: 1,
        hash: "c",
        kind: "template",
        status: "APPROVED",
      },
    },
    "222": {
      woolworths_login: { id: "900", rev: 1, hash: "a", kind: "flow" },
    },
  },
};

describe("buildIdMap", () => {
  it("splits flows and templates and strips the tpl:…@lang key", () => {
    expect(buildIdMap(lock.wabas["111"]!)).toEqual({
      flows: { legacy_flow: "101", woolworths_login: "100" },
      templates: { acme_welcome: "200" },
    });
  });

  it("throws when a template name is locked in multiple languages", () => {
    const section = {
      "tpl:welcome@en_US": { id: "1", rev: 1, hash: "x", kind: "template" as const },
      "tpl:welcome@es": { id: "2", rev: 1, hash: "y", kind: "template" as const },
    };
    expect(() => buildIdMap(section)).toThrow(/multiple languages/);
  });
});

describe("resolveLockedWaba", () => {
  it("returns the configured WABA id when it's in the lock", () => {
    const app: FlowsAppConfig = { waba: { id: "111" } };
    expect(resolveLockedWaba(app, lock)).toBe("111");
  });

  it("errors when WHATSAPP_WABA_ID is not set", () => {
    const app: FlowsAppConfig = { waba: { id: "" } };
    expect(() => resolveLockedWaba(app, lock)).toThrow(/WHATSAPP_WABA_ID/);
  });

  it("errors when the configured WABA has nothing locked", () => {
    const app: FlowsAppConfig = { waba: { id: "999" } };
    expect(() => resolveLockedWaba(app, lock)).toThrow(/No locked assets for WABA 999/);
  });
});

describe("rendering", () => {
  const map = buildIdMap(lock.wabas["111"]!);

  it("renders a single-quoted env line", () => {
    expect(renderEnvLine(map)).toBe(
      `WHATSAPP_FLOWS='{"flows":{"legacy_flow":"101","woolworths_login":"100"},"templates":{"acme_welcome":"200"}}'`,
    );
  });

  it("renders a typed const module with the WABA id", () => {
    const mod = renderModule(map, "111");
    expect(mod).toContain("export const WHATSAPP_WABA_ID = \"111\";");
    expect(mod).toContain("export const WHATSAPP_FLOWS = {");
    expect(mod).toContain("} as const;");
    expect(mod).toContain("export type WhatsappFlows = typeof WHATSAPP_FLOWS;");
    expect(mod).toContain('"woolworths_login": "100"');
  });
});
