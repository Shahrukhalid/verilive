/** Shared types for the detection engine. Everything here is plain data (no DOM). */

export type RGB = [number, number, number];

/** Measurements taken from one video frame for one tracked face. */
export interface FaceFrame {
  /** Seconds since the session started. */
  t: number;
  /** Mean skin colour of three regions, used for the pulse signal. Null when a region was not visible. */
  forehead: RGB | null;
  leftCheek: RGB | null;
  rightCheek: RGB | null;
  /** Blink blendshape scores, 0 (open) to 1 (closed). */
  blinkLeft: number;
  blinkRight: number;
  /** Head pose in degrees. */
  yaw: number;
  pitch: number;
  /** Mean absolute Laplacian (sharpness) of the inner face and of the outer face ring. */
  innerSharpness: number;
  outerSharpness: number;
  /** Chromaticity (r/(r+g+b), g/(r+g+b)) of inner face and outer ring. */
  innerChroma: [number, number];
  outerChroma: [number, number];
  /** Normalized residual motion of rigid landmarks after removing head movement. */
  jitter: number;
  /** Face width in source pixels. */
  faceWidthPx: number;
  /** Head movement since the previous frame, as a fraction of face width. */
  motion: number;
}

export type SignalId = "pulse" | "blink" | "texture" | "flicker" | "jitter" | "pose";

export type SignalMessageKey =
  | "pulse.collecting" | "pulse.natural" | "pulse.weak" | "pulse.absent"
  | "blink.collecting" | "blink.noneYet" | "blink.oneNatural" | "blink.manyNatural" | "blink.none" | "blink.regular" | "blink.asymmetric" | "blink.frequent"
  | "texture.collecting" | "texture.matches" | "texture.softer" | "texture.blurry"
  | "flicker.collecting" | "flicker.together" | "flicker.changes"
  | "jitter.collecting" | "jitter.steady" | "jitter.unstable"
  | "pose.notTested" | "pose.moreFootage" | "pose.consistent" | "pose.unstable";

export interface SignalDetail {
  key: SignalMessageKey;
  values?: Record<string, number>;
}

export interface SignalResult {
  id: SignalId;
  /** 0 = looks natural, 1 = looks synthetic. */
  suspicion: number;
  /** 0 = not enough data to judge, 1 = solid evidence. */
  confidence: number;
  /** Stable message key and values so the UI can translate detector details. */
  detail: SignalDetail;
  /** Raw numbers for the report. */
  metrics: Record<string, number>;
}

export type RiskLevel = "collecting" | "low" | "elevated" | "high";

export interface Assessment {
  level: RiskLevel;
  /** Weighted suspicion, 0..1. */
  score: number;
  /** How much evidence backs the score, 0..1. */
  confidence: number;
  signals: SignalResult[];
  /** The most important reasons, in order. */
  reasons: SignalDetail[];
}

export type Sensitivity = "relaxed" | "balanced" | "strict";
