import { describe } from "../i18n";
import { clamp, mean, median, ramp, round } from "./dsp";
import type { FaceFrame, SignalResult } from "./types";

export type Point = [number, number];

/**
 * Residual movement of `cur` after the best similarity transform (scale, rotation,
 * translation) maps `prev` onto it, divided by the size of the face. Head movement is
 * removed; what remains is the shape of the face itself wobbling.
 */
export function rigidResidual(prev: Point[], cur: Point[]): number {
  const n = Math.min(prev.length, cur.length);
  if (n < 3) return 0;
  const cp: Point = [mean(prev.map((p) => p[0])), mean(prev.map((p) => p[1]))];
  const cc: Point = [mean(cur.map((p) => p[0])), mean(cur.map((p) => p[1]))];
  let a = 0;
  let b = 0;
  let norm = 0;
  for (let i = 0; i < n; i++) {
    const px = prev[i]![0] - cp[0];
    const py = prev[i]![1] - cp[1];
    const qx = cur[i]![0] - cc[0];
    const qy = cur[i]![1] - cc[1];
    a += px * qx + py * qy;
    b += px * qy - py * qx;
    norm += px * px + py * py;
  }
  if (norm < 1e-12) return 0;
  const sa = a / norm; // s*cos(theta)
  const sb = b / norm; // s*sin(theta)
  let err = 0;
  let size = 0;
  for (let i = 0; i < n; i++) {
    const px = prev[i]![0] - cp[0];
    const py = prev[i]![1] - cp[1];
    const qx = cur[i]![0] - cc[0];
    const qy = cur[i]![1] - cc[1];
    err += (sa * px - sb * py - qx) ** 2 + (sb * px + sa * py - qy) ** 2;
    size += qx * qx + qy * qy;
  }
  return Math.sqrt(err / n) / Math.sqrt(size / n);
}

/** Landmarks of real faces move smoothly. Swapped faces often shimmer between frames. */
export function analyzeJitter(frames: FaceFrame[]): SignalResult {
  const base = { id: "jitter" as const, label: "Face shape stability" };
  const values = frames.map((f) => f.jitter).filter((j) => j > 0 && Number.isFinite(j));
  if (values.length < 30) {
    return { ...base, suspicion: 0, confidence: 0, ...describe("detail.jitter.collecting"), metrics: { frames: values.length } };
  }
  const j = median(values) * 1000;
  const motion = mean(frames.map((f) => f.motion));
  const size = mean(frames.map((f) => f.faceWidthPx));
  const suspicion = ramp(j, 8, 18);
  const confidence = clamp(ramp(values.length, 30, 200) * ramp(size, 50, 120) * (1 - ramp(motion, 0.04, 0.12)) * 0.55);
  const detail = suspicion < 0.35 ? describe("detail.jitter.ok") : describe("detail.jitter.bad");
  return { ...base, suspicion, confidence, ...detail, metrics: { jitterPerMille: round(j) } };
}

/**
 * Face swaps are trained mostly on front-facing photos and break down when the head turns.
 * Compares stability when the face is turned away against when it faces the camera.
 */
export function analyzePose(frames: FaceFrame[]): SignalResult {
  const base = { id: "pose" as const, label: "Head-turn test" };
  const frontal = frames.filter((f) => Math.abs(f.yaw) < 12);
  const turned = frames.filter((f) => Math.abs(f.yaw) > 28);
  const maxYaw = frames.reduce((m, f) => Math.max(m, Math.abs(f.yaw)), 0);
  if (frontal.length < 15 || turned.length < 8) {
    return {
      ...base,
      suspicion: 0,
      confidence: 0,
      ...describe(maxYaw < 28 ? "detail.pose.untested" : "detail.pose.moreFootage"),
      metrics: { maxYaw: Math.round(maxYaw), turnedFrames: turned.length },
    };
  }
  const jitterOf = (fs: FaceFrame[]) => median(fs.map((f) => f.jitter).filter((j) => j > 0));
  const ratio = jitterOf(turned) / Math.max(jitterOf(frontal), 1e-6);
  const suspicion = ramp(ratio, 2.2, 4.5);
  const confidence = clamp(ramp(turned.length, 8, 40) * 0.8);
  const detail = suspicion < 0.35 ? describe("detail.pose.ok") : describe("detail.pose.bad");
  return { ...base, suspicion, confidence, ...detail, metrics: { turnedToFrontal: round(ratio), maxYaw: Math.round(maxYaw), turnedFrames: turned.length } };
}

