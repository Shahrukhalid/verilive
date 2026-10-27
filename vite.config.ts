import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { injectCsp } from "./scripts/csp";

function csp(): Plugin {
  return { name: "verilive-csp", apply: "build", transformIndexHtml: injectCsp };
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
