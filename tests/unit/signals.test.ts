import { describe, expect, it } from "vitest";
import { analyzeFlicker, analyzeTexture } from "../../src/engine/appearance";
import { analyzeBlink, blinkStats } from "../../src/engine/blink";
import { analyzeJitter, analyzePose, rigidResidual, type Point } from "../../src/engine/geometry";
import { analyzePulse } from "../../src/engine/pulse";
import { naturalBlinks, synthFrames } from "./synth";

describe("pulse", () => {
  it("recognises a real pulse and reports the heart rate", () => {
    const r = analyzePulse(synthFrames({ bpm: 75 }));
    expect(r.suspicion).toBeLessThan(0.3);
    expect(r.confidence).toBeGreaterThan(0.5);
    expect(Math.abs(r.metrics.bpm! - 75)).toBeLessThanOrEqual(4);
  });

  it("flags skin with no pulse", () => {
    const r = analyzePulse(synthFrames({ bpm: 0 }));
    expect(r.suspicion).toBeGreaterThan(0.6);
  });

  it("does not judge with too little footage", () => {
    const r = analyzePulse(synthFrames({ seconds: 3 }));
    expect(r.confidence).toBe(0);
  });

  it("is less confident about small faces", () => {
    const big = analyzePulse(synthFrames({ faceWidthPx: 200 }));
    const small = analyzePulse(synthFrames({ faceWidthPx: 70 }));
    expect(small.confidence).toBeLessThan(big.confidence);
  });
});

describe("blink", () => {
  it("accepts natural blinking", () => {
    const r = analyzeBlink(synthFrames({ seconds: 60, blinks: naturalBlinks(60) }));
    expect(r.suspicion).toBeLessThan(0.3);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("flags a face that never blinks", () => {
    const r = analyzeBlink(synthFrames({ seconds: 60, blinks: [] }));
    expect(r.suspicion).toBeGreaterThan(0.6);
  });

  it("flags metronome blinking", () => {
    const blinks = Array.from({ length: 15 }, (_, i) => 1 + i * 4);
    const r = analyzeBlink(synthFrames({ seconds: 60, blinks }));
    expect(r.suspicion).toBeGreaterThan(0.6);
  });

  it("counts blinks once each", () => {
    expect(blinkStats(synthFrames({ seconds: 30, blinks: [2, 9, 15] })).count).toBe(3);
  });
});

describe("appearance", () => {
  it("accepts matching detail and flags a blurry inner face", () => {
    expect(analyzeTexture(synthFrames({ innerToOuter: 1.5 })).suspicion).toBeLessThan(0.2);
    expect(analyzeTexture(synthFrames({ innerToOuter: 0.55 })).suspicion).toBeGreaterThan(0.8);
  });

  it("flags colour flicker of the inner face", () => {
    expect(analyzeFlicker(synthFrames({ flicker: 0.0003 })).suspicion).toBeLessThan(0.2);
    expect(analyzeFlicker(synthFrames({ flicker: 0.006 })).suspicion).toBeGreaterThan(0.6);
  });
});

describe("geometry", () => {
  it("ignores pure head movement", () => {
    const pts: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.3]];
    const moved = pts.map(([x, y]): Point => {
      const c = Math.cos(0.3), s = Math.sin(0.3);
      return [1.4 * (c * x - s * y) + 3, 1.4 * (s * x + c * y) - 2];
    });
    expect(rigidResidual(pts, moved)).toBeLessThan(1e-9);
    const warped = moved.map(([x, y], i): Point => (i === 4 ? [x + 0.2, y] : [x, y]));
    expect(rigidResidual(pts, warped)).toBeGreaterThan(0.01);
  });

  it("flags a shimmering face shape", () => {
    expect(analyzeJitter(synthFrames({ jitter: 0.005 })).suspicion).toBe(0);
    expect(analyzeJitter(synthFrames({ jitter: 0.03 })).suspicion).toBeGreaterThan(0.8);
  });

  it("head-turn test: stays quiet until the head turns, then compares", () => {
    expect(analyzePose(synthFrames()).confidence).toBe(0);
    const yaw = (t: number) => (t % 10 < 5 ? 0 : 40);
    const real = analyzePose(synthFrames({ yaw, jitterAtYaw: (y) => (y > 20 ? 0.008 : 0.005) }));
    const swap = analyzePose(synthFrames({ yaw, jitterAtYaw: (y) => (y > 20 ? 0.03 : 0.005) }));
    expect(real.confidence).toBeGreaterThan(0.4);
    expect(real.suspicion).toBeLessThan(0.2);
    expect(swap.suspicion).toBeGreaterThan(0.8);
  });
});

describe("audit regressions", () => {
  it("head-turn test does not flag a face when frontal frames have no measured wobble", () => {
    const yaw = (t: number) => (t % 10 < 5 ? 0 : 40);
    // Jitter is 0 when it could not be measured (e.g. right after a detection gap).
    const r = analyzePose(synthFrames({ yaw, jitterAtYaw: (y) => (y > 20 ? 0.008 : 0) }));
    expect(r.confidence).toBe(0);
    expect(r.suspicion).toBe(0);
  });

  it("pulse coherence is not broken by a forehead gap at the start", () => {
    const frames = synthFrames({ bpm: 72, seconds: 30 }).map((f) => (f.t < 2 ? { ...f, forehead: null } : f));
    const r = analyzePulse(frames);
    expect(r.metrics.coherence).toBeGreaterThan(0.5);
    expect(r.suspicion).toBeLessThan(0.3);
  });
});
