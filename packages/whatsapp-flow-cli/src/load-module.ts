import { build } from "esbuild";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** When running inside the monorepo, resolve the framework packages to their
 * TypeScript source so the compiler works without a prior build. Falls back to
 * normal node resolution (dist) when the source isn't present (published use). */
function frameworkAlias(): Record<string, string> | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packagesDir = path.resolve(here, "../../");
  const tsxSrc = path.join(packagesDir, "whatsapp-flow-tsx", "src");
  const coreSrc = path.join(packagesDir, "whatsapp-flow-core", "src");
  if (!existsSync(path.join(tsxSrc, "index.ts"))) return undefined;
  return {
    "whatsapp-flow-tsx/jsx-runtime": path.join(tsxSrc, "jsx-runtime.ts"),
    "whatsapp-flow-tsx/jsx-dev-runtime": path.join(tsxSrc, "jsx-runtime.ts"),
    "whatsapp-flow-tsx": path.join(tsxSrc, "index.ts"),
    "whatsapp-flow-core": path.join(coreSrc, "index.ts"),
  };
}

/** Transpile + bundle a .ts/.tsx module with our JSX runtime and load it. */
export async function loadModule(file: string): Promise<Record<string, unknown>> {
  const result = await build({
    entryPoints: [file],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    jsx: "automatic",
    jsxImportSource: "whatsapp-flow-tsx",
    alias: frameworkAlias(),
    logLevel: "silent",
    absWorkingDir: path.dirname(file),
  });
  const code = result.outputFiles[0]?.text ?? "";
  const dir = await mkdtemp(path.join(tmpdir(), "waflow-"));
  const out = path.join(dir, "module.mjs");
  await writeFile(out, code);
  try {
    return (await import(pathToFileURL(out).href)) as Record<string, unknown>;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
