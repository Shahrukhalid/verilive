// Copies MediaPipe's WebAssembly runtime into public/ so the app never loads code from a CDN.
// Only the two variants FilesetResolver uses (SIMD and the no-SIMD fallback) are copied.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(root, "public", "mediapipe", "wasm");
mkdirSync(dest, { recursive: true });
for (const name of ["vision_wasm_internal", "vision_wasm_nosimd_internal"]) {
  for (const ext of [".js", ".wasm"]) copyFileSync(join(src, name + ext), join(dest, name + ext));
}
console.log("copied MediaPipe wasm runtime to public/mediapipe/wasm");
