import type { FaceFrame, RGB } from "../../src/engine/types";

/** Deterministic pseudo-random numbers so tests never flake. */
export function rng(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export interface SynthOptions {
  seconds?: number;
  fps?: number;
  /** Heart rate in beats per minute; 0 for no pulse. */
  bpm?: number;
  /** Pulse amplitude in 8-bit colour units. */
  pulseAmp?: number;
  /** Colour noise in 8-bit units. */
  noise?: number;
  /** Seconds at which blinks start. */
  blinks?: number[];
  innerToOuter?: number;
  flicker?: number;
  jitter?: number;
  yaw?: (t: number) => number;
  /** Jitter as a function of yaw (to model face swaps breaking when turned). */
  jitterAtYaw?: (yaw: number) => number;
  faceWidthPx?: number;
  seed?: number;
}

export function synthFrames(o: SynthOptions = {}): FaceFrame[] {
  const {
    seconds = 30, fps = 15, bpm = 72, pulseAmp = 0.6, noise = 0.25, blinks = [], innerToOuter = 1.6,
    flicker = 0.0004, jitter = 0.005, yaw = () => 0, jitterAtYaw, faceWidthPx = 180, seed = 7,
  } = o;
  const r = rng(seed);
  const n = (k: number) => (r() - 0.5) * 2 * k;
  const out: FaceFrame[] = [];
  const base: RGB = [180, 130, 110];
  for (let i = 0; i < seconds * fps; i++) {
    const t = i / fps + n(0.004);
    const p = bpm ? Math.sin(2 * Math.PI * (bpm / 60) * t) : 0;
    // Blood volume changes mostly affect green, then red, least blue.
    const skin = (amp: number): RGB => [
      base[0] + 0.5 * amp * p + n(noise),
      base[1] + amp * p + n(noise),
      base[2] + 0.25 * amp * p + n(noise),
    ];
    const blinking = blinks.some((b) => t >= b && t < b + 0.2);
    const y = yaw(t);
    out.push({
      t,
      forehead: skin(pulseAmp),
      leftCheek: skin(pulseAmp * 0.9),
      rightCheek: skin(pulseAmp * 0.9),
      blinkLeft: blinking ? 0.9 : 0.05 + r() * 0.05,
      blinkRight: blinking ? 0.88 : 0.05 + r() * 0.05,
      yaw: y,
      pitch: 0,
      innerSharpness: 10 * innerToOuter * (1 + n(0.05)),
      outerSharpness: 10 * (1 + n(0.05)),
      innerChroma: [0.42 + n(flicker), 0.31 + n(flicker)],
      outerChroma: [0.42, 0.31],
      jitter: (jitterAtYaw ? jitterAtYaw(y) : jitter) * (1 + n(0.2)),
      faceWidthPx,
      motion: 0.005,
    });
  }
  return out;
}

/** Blinks every ~3-5 s at irregular intervals, like a person. */
export function naturalBlinks(seconds: number, seed = 3): number[] {
  const r = rng(seed);
  const out: number[] = [];
  for (let t = 1 + r() * 2; t < seconds; t += 2 + r() * 4) out.push(t);
  return out;
}
