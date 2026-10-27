import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// ESLint's own defineConfig() supports `extends` in flat config (ESLint 9.22+).
export default defineConfig(
  { ignores: ["dist", "public/mediapipe", "playwright-report", "test-results", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    extends: [js.configs.recommended],
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
);
