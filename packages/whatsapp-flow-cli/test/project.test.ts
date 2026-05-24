import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFlowFile } from "../src/single-file.ts";
import { hashJson } from "../src/lockfile.ts";
import { isProjectDir, loadProject } from "../src/project.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const at = (p: string): string => path.join(root, p);

describe("single-file flows", () => {
  it("compiles a single-screen flow with a name override", async () => {
    const c = await compileFlowFile(at("fixtures/app/login.tsx"), { namePrefix: "test_" });
    expect(c.name).toBe("custom_login");
    expect(c.categories).toEqual(["SIGN_IN"]);
    expect(c.flow.screens.map((s) => s.id)).toEqual(["START"]);
    expect(c.flow.screens[0]!.terminal).toBe(true);
    expect(c.flow.screens[0]!.success).toBe(true);
  });

  it("derives the name from the filename + namePrefix and routes by export name", async () => {
    const c = await compileFlowFile(at("fixtures/app/signup.tsx"), {
      namePrefix: "test_",
      version: "7.2",
    });
    expect(c.name).toBe("test_signup");
    expect(c.flow.version).toBe("7.2");
    // Index -> START ("/"), Details -> DETAILS ("/details"); Next links them.
    expect(c.flow.screens.map((s) => s.id)).toEqual(["START", "DETAILS"]);
    expect(c.flow.routing_model).toEqual({ START: ["DETAILS"], DETAILS: [] });
  });

  it("produces a stable content hash across recompiles (change detection)", async () => {
    const a = await compileFlowFile(at("fixtures/app/login.tsx"), { namePrefix: "test_" });
    const b = await compileFlowFile(at("fixtures/app/login.tsx"), { namePrefix: "test_" });
    expect(hashJson(a.flow)).toBe(hashJson(b.flow));
  });
});

describe("project loader", () => {
  it("detects a flows app and discovers its flow files", async () => {
    expect(isProjectDir(at("fixtures/app"))).toBe(true);
    expect(isProjectDir(at("fixtures/basic-lead-form"))).toBe(false);

    const project = await loadProject(at("fixtures/app"));
    expect(project.app.namePrefix).toBe("test_");
    expect(project.app.defaultWaba).toBe("dev");
    expect(project.flowFiles.map((f) => path.basename(f))).toEqual(["login.tsx", "signup.tsx"]);
  });
});
