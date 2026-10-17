import { clamp } from "./dsp";
import type { Assessment, RiskLevel, Sensitivity, SignalId, SignalResult } from "./types";

/** How much each signal counts. Pulse and the head-turn test are the strongest tells. */
export const WEIGHTS: Record<SignalId, number> = {
  pulse: 0.3,
  pose: 0.22,
  texture: 0.16,
  blink: 0.12,
  flicker: 0.1,
  jitter: 0.1,
};

const SHIFT: Record<Sensitivity, number> = { relaxed: 0.08, balanced: 0, strict: -0.08 };

/** Below this much weighted evidence the app says "collecting" instead of guessing. */
export const MIN_CONFIDENCE = 0.3;

/**
 * Two families of evidence. A replayed photo or video fails the liveness family (no pulse,
 * no blinking) while looking perfectly sharp; a face swap on a live person may keep some
 * pulse but leaves artifacts. Averaging the two would hide either attack, so the overall
 * score is the worse of the two families.
 */
export const FAMILY: Record<SignalId, "liveness" | "artifacts"> = {
  pulse: "liveness",
  blink: "liveness",
  texture: "artifacts",
  flicker: "artifacts",
  jitter: "artifacts",
  pose: "artifacts",
};

function familyScore(signals: SignalResult[]): { score: number; evidence: number } {
  let num = 0;
  let den = 0;
  for (const s of signals) {
    const w = WEIGHTS[s.id];
    num += w * s.confidence * s.suspicion;
    den += w * s.confidence;
  }
  const weight = signals.reduce((t, s) => t + WEIGHTS[s.id], 0);
  return { score: den > 0 ? num / den : 0, evidence: weight > 0 ? den / weight : 0 };
}

export function combine(signals: SignalResult[], sensitivity: Sensitivity = "balanced"): Assessment {
  const total = signals.reduce((t, s) => t + WEIGHTS[s.id], 0);
  const den = signals.reduce((t, s) => t + WEIGHTS[s.id] * s.confidence, 0);
  const confidence = total > 0 ? clamp(den / (total * 0.6)) : 0;
  const live = familyScore(signals.filter((s) => FAMILY[s.id] === "liveness"));
  const art = familyScore(signals.filter((s) => FAMILY[s.id] === "artifacts"));
  // A family only counts once it has some evidence behind it.
  const score = Math.max(live.evidence >= 0.2 ? live.score : 0, art.evidence >= 0.2 ? art.score : 0);

  const shift = SHIFT[sensitivity];
  let level: RiskLevel;
  if (confidence < MIN_CONFIDENCE) level = "collecting";
  else if (score >= 0.6 + shift) level = "high";
  else if (score >= 0.35 + shift) level = "elevated";
  else level = "low";

  // One strong, well-supported tell is enough to raise a flag even if the others look fine.
  const strong = signals.some((s) => s.suspicion >= 0.8 && s.confidence >= 0.6);
  if (strong && level === "low") level = "elevated";

  const reasons = signals
    .filter((s) => s.confidence >= 0.25)
    .sort((a, b) => b.suspicion * WEIGHTS[b.id] * b.confidence - a.suspicion * WEIGHTS[a.id] * a.confidence)
    .filter((s) => (level === "low" ? true : s.suspicion >= 0.35))
    .slice(0, 3)
    .map((s) => s.detail);

  return { level, score: clamp(score), confidence, signals, reasons };
}
