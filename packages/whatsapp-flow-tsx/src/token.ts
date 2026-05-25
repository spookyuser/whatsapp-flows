import { spawnSync } from "node:child_process";
import type { TokenContext } from "./define-flow.ts";

/** Build a token resolver that runs `command` and returns its trimmed stdout.
 * This is a shell-*out*, not a shell: the command splits on whitespace and is
 * spawned directly (no interpolation, no quoting). Good for the common case
 * (`"convex env get WHATSAPP_ACCESS_TOKEN"`); for anything needing quotes or
 * pipes, pass an inline function instead. */
export function fromCommand(command: string): (ctx: TokenContext) => string {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  return () => {
    const [cmd, ...args] = parts;
    if (!cmd) throw new Error("fromCommand: empty command");
    const res = spawnSync(cmd, args, { encoding: "utf8" });
    if (res.error) throw res.error;
    if (res.status !== 0) {
      const stderr = (res.stderr || "").trim();
      throw new Error(
        `Token command \`${command}\` exited with ${res.status ?? "signal " + res.signal}` +
          (stderr ? `:\n${stderr}` : "."),
      );
    }
    return res.stdout.trim();
  };
}
