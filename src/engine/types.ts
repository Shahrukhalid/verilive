/** Shared types for the detection engine. Everything here is plain data (no DOM). */

import type { Params, TranslationKey } from "../i18n";

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

export interface SignalResult {
  id: SignalId;
  label: string;
  /** 0 = looks natural, 1 = looks synthetic. */
  suspicion: number;
  /** 0 = not enough data to judge, 1 = solid evidence. */
  confidence: number;
  /** One plain-language sentence for the user, in English. */
  detail: string;
  /** The same sentence as a translation key plus parameters, so the interface can show it in any language. */
  detailKey?: TranslationKey;
  detailParams?: Params;
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
  /** The most important reasons, in order, in English. */
  reasons: string[];
  /** The signals behind `reasons`, in the same order, for translating them. */
  reasonIds: SignalId[];
}

export type Sensitivity = "relaxed" | "balanced" | "strict";
