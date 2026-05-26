import { transform } from "esbuild";
import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllEnvIdMaps, buildIdMap, renderEnvLine, renderModule } from "../src/ids.ts";
import type { Lockfile } from "../src/lockfile.ts";
import { readLock } from "../src/lockfile.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const at = (p: string): string => path.join(root, p);

const lock: Lockfile = {
  version: 2,
  envs: {
    dev: {
      wabaId: "111",
      assets: {
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
    },
    prod: {
      wabaId: "222",
      assets: {
        woolworths_login: { id: "900", rev: 1, hash: "a", kind: "flow" },
      },
    },
  },
};

describe("buildIdMap", () => {
  it("splits flows and templates and strips the tpl:…@lang key", () => {
    expect(buildIdMap(lock.envs.dev!.assets)).toEqual({
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

describe("buildAllEnvIdMaps", () => {
  it("collects every env's wabaId, flows and templates", () => {
    expect(buildAllEnvIdMaps(lock)).toEqual({
      wabas: { dev: "111", prod: "222" },
      flows: {
        dev: { legacy_flow: "101", woolworths_login: "100" },
        prod: { woolworths_login: "900" },
      },
      templates: {
        dev: { acme_welcome: "200" },
        prod: {},
      },
    });
  });
});

describe("rendering", () => {
  it("renders a single-quoted env line from one env's map", () => {
    expect(renderEnvLine(buildIdMap(lock.envs.dev!.assets))).toBe(
      `WHATSAPP_FLOWS='{"flows":{"legacy_flow":"101","woolworths_login":"100"},"templates":{"acme_welcome":"200"}}'`,
    );
  });

  it("renders a typed all-envs module with flowId/templateId helpers", () => {
    const mod = renderModule(buildAllEnvIdMaps(lock), "dev");
    expect(mod).toContain("export const WHATSAPP_WABAS = {");
    expect(mod).toContain("export const WHATSAPP_FLOWS = {");
    expect(mod).toContain("export type WhatsappEnv = keyof typeof WHATSAPP_FLOWS;");
    expect(mod).toContain("export function flowId(name: FlowName");
    expect(mod).toContain("export function templateId(name: TemplateName");
    expect(mod).toContain('process.env.WHATSAPP_ENV ?? "dev"');
    expect(mod).toContain('"woolworths_login": "100"');
  });

  it("bakes the project's default env into the generated helper default", () => {
    const mod = renderModule(buildAllEnvIdMaps(lock), "prod");
    expect(mod).toContain('process.env.WHATSAPP_ENV ?? "prod"');
  });

  it("flowId/templateId throw on unknown env or name (executed)", async () => {
    const mod = renderModule(buildAllEnvIdMaps(lock), "dev");
    const js = (await transform(mod, { loader: "ts" })).code;
    const dataUrl = "data:text/javascript;base64," + Buffer.from(js).toString("base64");
    const m = (await import(dataUrl)) as {
      flowId: (n: string, e?: string) => string;
      templateId: (n: string, e?: string) => string;
    };
    expect(m.flowId("woolworths_login", "prod")).toBe("900");
    expect(() => m.flowId("woolworths_login", "staging")).toThrow(/Unknown env/);
    expect(() => m.flowId("nope", "dev")).toThrow(/No locked flow id/);
    expect(() => m.templateId("acme_welcome", "prod")).toThrow(/No locked template id/);
  });

  it("produces a stable snapshot for a populated multi-env lockfile", async () => {
    const fixtureLock = await readLock(at("fixtures/multi-env-app"));
    expect(renderModule(buildAllEnvIdMaps(fixtureLock), "dev")).toMatchSnapshot();
  });
});

describe("readLock", () => {
  it("reads a v2 lockfile keyed by env name", async () => {
    const l = await readLock(at("fixtures/multi-env-app"));
    expect(l.version).toBe(2);
    expect(Object.keys(l.envs).sort()).toEqual(["dev", "prod"]);
    expect(l.envs.dev!.wabaId).toBe("2142644013223594");
  });

  it("throws an upgrade hint on a legacy v1 lockfile", async () => {
    await expect(readLock(at("fixtures/legacy-lock-app"))).rejects.toThrow(
      /v1 lockfile[\s\S]*Upgrade it by hand/,
    );
  });
});
