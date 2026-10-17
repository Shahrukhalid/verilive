import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

/** Strict Content Security Policy for the production build: the page can only talk to itself. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function csp(): Plugin {
  return {
    name: "verilive-csp",
    apply: "build",
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`),
  };
}

// Served from https://<user>.github.io/verilive/ in production; "/" locally.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? (process.env.VERILIVE_BASE ?? "/verilive/") : "/",
  plugins: [react(), csp()],
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 1200 },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
}));
