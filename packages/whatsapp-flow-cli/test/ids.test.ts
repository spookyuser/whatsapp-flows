import { describe, expect, it } from "vitest";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import type { Lockfile } from "../src/lockfile.ts";
import { buildIdMap, renderEnvLine, renderModule, selectWaba } from "../src/ids.ts";

const lock: Lockfile = {
  version: 1,
  wabas: {
    dev: {
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
    prod: {
      woolworths_login: { id: "900", rev: 1, hash: "a", kind: "flow" },
    },
  },
};

describe("buildIdMap", () => {
  it("splits flows and templates and strips the tpl:…@lang key", () => {
    expect(buildIdMap(lock.wabas.dev!)).toEqual({
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

describe("selectWaba", () => {
  const app: FlowsAppConfig = {
    wabas: { dev: { id: "1" }, prod: { id: "2" } },
    defaultWaba: "prod",
  };

  it("uses the app defaultWaba when no flag is given", () => {
    expect(selectWaba(app, lock, undefined)).toBe("prod");
  });

  it("honors an explicit --waba", () => {
    expect(selectWaba(app, lock, "dev")).toBe("dev");
  });

  it("rejects --waba both", () => {
    expect(() => selectWaba(app, lock, "both")).toThrow(/both isn't supported/);
  });

  it("errors when nothing is locked", () => {
    expect(() => selectWaba(app, { version: 1, wabas: {} }, undefined)).toThrow(
      /whatsapp-flow push/,
    );
  });

  it("errors on an unknown WABA", () => {
    expect(() => selectWaba(app, lock, "staging")).toThrow(/No locked assets for WABA "staging"/);
  });
});

describe("rendering", () => {
  const map = buildIdMap(lock.wabas.dev!);

  it("renders a single-quoted env line", () => {
    expect(renderEnvLine(map)).toBe(
      `WHATSAPP_FLOWS='{"flows":{"legacy_flow":"101","woolworths_login":"100"},"templates":{"acme_welcome":"200"}}'`,
    );
  });

  it("renders a typed const module", () => {
    const mod = renderModule(map, "dev");
    expect(mod).toContain("export const WHATSAPP_FLOWS = {");
    expect(mod).toContain("} as const;");
    expect(mod).toContain("export type WhatsappFlows = typeof WHATSAPP_FLOWS;");
    expect(mod).toContain('"woolworths_login": "100"');
    expect(mod).toContain('WABA "dev"');
  });
});
