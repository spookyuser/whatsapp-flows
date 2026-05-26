import { describe, expect, it } from "vitest";
import { isLegacyLock } from "../src/lockfile.ts";

describe("isLegacyLock", () => {
  it("recognizes v1 by version", () => {
    expect(isLegacyLock({ version: 1, wabas: {} })).toBe(true);
  });
  it("recognizes v1 by shape (wabas, no envs)", () => {
    expect(isLegacyLock({ wabas: {} })).toBe(true);
  });
  it("rejects v2", () => {
    expect(isLegacyLock({ version: 2, envs: {} })).toBe(false);
  });
});
