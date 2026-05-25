import { describe, expect, it } from "vitest";
import { fromCommand } from "../src/token.ts";

const ctx = { env: "dev", wabaId: "111" };

describe("fromCommand", () => {
  it("resolves to the command's trimmed stdout", () => {
    expect(fromCommand("echo hello")(ctx)).toBe("hello");
  });

  it("splits args on whitespace (shell-less)", () => {
    expect(fromCommand("printf %s-%s a b")(ctx)).toBe("a-b");
  });

  it("throws with stderr when the command exits non-zero", () => {
    // No whitespace inside the -e arg, so the shell-less splitter keeps it whole.
    const fn = fromCommand("node -e console.error('boom');process.exit(3)");
    expect(() => fn(ctx)).toThrow(/exited with 3[\s\S]*boom/);
  });

  it("throws when the binary does not exist", () => {
    expect(() => fromCommand("definitely-not-a-real-binary-xyz")(ctx)).toThrow();
  });
});
