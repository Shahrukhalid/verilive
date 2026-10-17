import { clamp, mean, median, ramp, round, std } from "./dsp";
import type { FaceFrame, SignalResult } from "./types";

/**
 * Face-swap tools generate the inner face (eyes, nose, mouth) at low resolution and paste
 * it onto the real head. The pasted area is often softer than the cheeks and forehead
 * around it, even though it contains the most detailed features.
 */
export function analyzeTexture(frames: FaceFrame[]): SignalResult {
  const base = { id: "texture" as const };
  const ratios = frames.filter((f) => f.outerSharpness > 0.5).map((f) => f.innerSharpness / f.outerSharpness);
  const size = mean(frames.map((f) => f.faceWidthPx));
  if (ratios.length < 20) {
    return { ...base, suspicion: 0, confidence: 0, detail: { key: "texture.collecting" }, metrics: { frames: ratios.length } };
  }
  const ratio = median(ratios);
  // Eyes, brows and lips make the feature area clearly sharper than the cheeks on a real
  // face (ratio around 1.4 to 1.8 on call video). A pasted face loses that edge.
  const suspicion = ramp(ratio, 1.3, 0.85);
  const confidence = clamp(ramp(ratios.length, 20, 120) * ramp(size, 60, 150) * 0.75);
  const detail =
    suspicion < 0.35
      ? { key: "texture.matches" as const }
      : suspicion < 0.65
        ? { key: "texture.softer" as const }
        : { key: "texture.blurry" as const };
  return { ...base, suspicion, confidence, detail, metrics: { innerToOuterSharpness: round(ratio), frames: ratios.length } };
}

/**
 * A pasted face is re-rendered every frame, so its colour flickers slightly against the
 * real skin around it. Lighting changes affect both areas together and cancel out here.
 */
export function analyzeFlicker(frames: FaceFrame[]): SignalResult {
  const base = { id: "flicker" as const };
  if (frames.length < 30) {
    return { ...base, suspicion: 0, confidence: 0, detail: { key: "flicker.collecting" }, metrics: { frames: frames.length } };
  }
  const steps: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1]!;
    const b = frames[i]!;
    if (b.t - a.t > 0.25) continue; // skip gaps
    const da0 = a.innerChroma[0] - a.outerChroma[0];
    const da1 = a.innerChroma[1] - a.outerChroma[1];
    const db0 = b.innerChroma[0] - b.outerChroma[0];
    const db1 = b.innerChroma[1] - b.outerChroma[1];
    steps.push(Math.hypot(db0 - da0, db1 - da1));
  }
  const flicker = median(steps) * 1000; // in thousandths of chromaticity
  const spread = std(steps) * 1000;
  const motion = mean(frames.map((f) => f.motion));
  const suspicion = ramp(flicker, 1.0, 3.0);
  const confidence = clamp(ramp(steps.length, 30, 200) * (1 - ramp(motion, 0.03, 0.1)) * 0.6);
  const detail =
    suspicion < 0.35
      ? { key: "flicker.together" as const }
      : { key: "flicker.changes" as const };
  return { ...base, suspicion, confidence, detail, metrics: { flicker: round(flicker), spread: round(spread) } };
}
