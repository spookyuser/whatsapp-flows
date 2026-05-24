import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.turbo/**",
      "**/.build/**",
      "node_modules/**",
      "coverage/**",
      "fixtures/**",
    ],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["packages/whatsapp-flow-tsx/src/jsx-runtime.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-namespace": "off",
    },
  },
);
