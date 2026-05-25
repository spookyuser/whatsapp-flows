import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "../../..");

// JSONC-lite: these configs have no comments, but be tolerant of trailing commas.
function readJson(p: string): { compilerOptions: Record<string, unknown> } {
  return JSON.parse(readFileSync(p, "utf8"));
}

const preset = readJson(path.join(pkgRoot, "tsconfig.preset.json")).compilerOptions;
const base = readJson(path.join(repoRoot, "tsconfig.base.json")).compilerOptions;

// Build-only options that the consumer preset intentionally omits.
const IGNORE = new Set(["declaration", "ignoreDeprecations", "rootDir"]);

describe("tsconfig preset", () => {
  it("sets the author-facing JSX options", () => {
    expect(preset.jsx).toBe("react-jsx");
    expect(preset.jsxImportSource).toBe("whatsapp-flow-tsx");
  });

  it("does not drift from tsconfig.base.json on shared compilerOptions", () => {
    const drift: string[] = [];
    for (const [key, value] of Object.entries(base)) {
      if (IGNORE.has(key)) continue;
      if (JSON.stringify(preset[key]) !== JSON.stringify(value)) {
        drift.push(`${key}: base=${JSON.stringify(value)} preset=${JSON.stringify(preset[key])}`);
      }
    }
    expect(drift).toEqual([]);
  });
});
