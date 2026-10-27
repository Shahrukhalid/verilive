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
    transformIndexHtml: (html) => {
      const charset = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i;
      // Fail the build rather than ship a page without its Content Security Policy.
      if (!charset.test(html)) throw new Error("verilive-csp: <meta charset> not found in index.html; cannot inject the Content Security Policy.");
      return html.replace(charset, (tag) => `${tag}\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`);
    },
  };
}

/**
 * The dev server cannot use the full policy (Vite injects inline scripts for hot reload), but it
 * still blocks requests to other origins, such as the usage metrics the MediaPipe library tries to
 * send to Google. 'self' also covers Vite's own hot-reload WebSocket.
 */
const DEV_CSP = "connect-src 'self'";

// Served from https://<user>.github.io/verilive/ in production; "/" locally.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? (process.env.VERILIVE_BASE ?? "/verilive/") : "/",
  plugins: [react(), csp()],
  server: { headers: { "Content-Security-Policy": DEV_CSP } },
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 1200 },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
}));
