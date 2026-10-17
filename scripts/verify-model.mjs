// Fails the build if the bundled face model is not the official MediaPipe release.
// Official source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MODEL_SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "models", "face_landmarker.task");
const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
if (actual !== MODEL_SHA256) {
  console.error(`face_landmarker.task checksum mismatch: ${actual}`);
  process.exit(1);
}
console.log("face model checksum OK");
