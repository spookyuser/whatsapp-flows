import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";
import { compileFlowFile } from "../src/single-file.ts";
import { hashJson } from "../src/lockfile.ts";
import { findProjectDir, isProjectDir, loadProject, resolveEnv } from "../src/project.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const at = (p: string): string => path.join(root, p);

describe("single-file flows", () => {
  it("compiles a single-screen flow with a custom name", async () => {
    const c = await compileFlowFile(at("fixtures/app/login.tsx"));
    expect(c.name).toBe("custom_login");
    expect(c.categories).toEqual(["SIGN_IN"]);
    expect(c.flow.screens.map((s) => s.id)).toEqual(["START"]);
    expect(c.flow.screens[0]!.terminal).toBe(true);
    expect(c.flow.screens[0]!.success).toBe(true);
  });

  it("derives the name from the filename and routes by export name", async () => {
    const c = await compileFlowFile(at("fixtures/app/signup.tsx"), { version: "7.3" });
    expect(c.name).toBe("signup");
    expect(c.flow.version).toBe("7.3");
    expect(c.flow.screens.map((s) => s.id)).toEqual(["START", "DETAILS"]);
    expect(c.flow.routing_model).toEqual({ START: ["DETAILS"], DETAILS: [] });
  });

  it("produces a stable content hash across recompiles (change detection)", async () => {
    const a = await compileFlowFile(at("fixtures/app/login.tsx"));
    const b = await compileFlowFile(at("fixtures/app/login.tsx"));
    expect(hashJson(a.flow)).toBe(hashJson(b.flow));
  });
});

describe("project loader", () => {
  it("detects a flows app and discovers its flow files", async () => {
    expect(isProjectDir(at("fixtures/app"))).toBe(true);
    expect(isProjectDir(at("fixtures"))).toBe(false);

    const project = await loadProject(at("fixtures/app"));
    expect(project.app.version).toBe("7.3");
    expect(project.flowFiles.map((f) => path.basename(f))).toEqual(["login.tsx", "signup.tsx"]);
  });

  it("auto-picks the only env and resolves its WABA id", async () => {
    const project = await loadProject(at("fixtures/app"));
    expect(project.env).toBe("dev");
    expect(project.wabaId).toBe("111");
  });

  it("honors an explicit --env on a multi-env app", async () => {
    const project = await loadProject(at("fixtures/multi-env-app"), { env: "prod" });
    expect(project.env).toBe("prod");
    expect(project.wabaId).toBe("26870122239247230");
  });

  it("falls back to defaultEnv on a multi-env app", async () => {
    const project = await loadProject(at("fixtures/multi-env-app"));
    expect(project.env).toBe("dev");
  });
});

describe("resolveEnv precedence", () => {
  const original = process.env.WHATSAPP_ENV;
  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_ENV;
    else process.env.WHATSAPP_ENV = original;
  });

  const multi: FlowsAppConfig = {
    wabas: { dev: { id: "1" }, prod: { id: "2" } },
    defaultEnv: "dev",
  };

  it("explicit option beats everything", () => {
    process.env.WHATSAPP_ENV = "prod";
    expect(resolveEnv(multi, { env: "staging" })).toBe("staging");
  });

  it("WHATSAPP_ENV beats defaultEnv", () => {
    process.env.WHATSAPP_ENV = "prod";
    expect(resolveEnv(multi)).toBe("prod");
  });

  it("defaultEnv beats auto-pick", () => {
    delete process.env.WHATSAPP_ENV;
    expect(resolveEnv(multi)).toBe("dev");
  });

  it("auto-picks the single env when nothing else is set", () => {
    delete process.env.WHATSAPP_ENV;
    expect(resolveEnv({ wabas: { only: { id: "1" } } })).toBe("only");
  });

  it("throws when ambiguous (multiple envs, no default, no flag)", () => {
    delete process.env.WHATSAPP_ENV;
    expect(() => resolveEnv({ wabas: { dev: { id: "1" }, prod: { id: "2" } } })).toThrow(
      /Ambiguous env/,
    );
  });

  it("throws when no wabas are configured", () => {
    delete process.env.WHATSAPP_ENV;
    expect(() => resolveEnv({ wabas: {} })).toThrow(/No `wabas`/);
  });
});

describe("walk-up discovery", () => {
  it("walks up from a nested subdir to the fixture root", () => {
    const found = findProjectDir(at("fixtures/app"));
    expect(found).toBe(at("fixtures/app"));
  });

  it("returns null when no flows app is up the tree", () => {
    expect(findProjectDir("/tmp")).toBeNull();
  });
});

describe("package.json#whatsappFlows fallback", () => {
  it("loads config from package.json when there is no flows.config.ts", async () => {
    expect(isProjectDir(at("fixtures/pkg-config-app"))).toBe(true);
    const project = await loadProject(at("fixtures/pkg-config-app"));
    expect(project.app.version).toBe("7.3");
    expect(project.env).toBe("dev");
    expect(project.wabaId).toBe("555");
    expect(project.flowFiles.map((f) => path.basename(f))).toEqual(["checkout.tsx", "notify.tsx"]);
  });
});
