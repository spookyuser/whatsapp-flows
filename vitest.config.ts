import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "whatsapp-flow-core": r("./packages/whatsapp-flow-core/src/index.ts"),
      "whatsapp-flow-tsx/jsx-runtime": r("./packages/whatsapp-flow-tsx/src/jsx-runtime.ts"),
      "whatsapp-flow-tsx/jsx-dev-runtime": r("./packages/whatsapp-flow-tsx/src/jsx-runtime.ts"),
      "whatsapp-flow-tsx": r("./packages/whatsapp-flow-tsx/src/index.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "whatsapp-flow-tsx",
  },
  test: {
    globals: false,
    include: ["packages/**/test/**/*.test.{ts,tsx}"],
  },
});
