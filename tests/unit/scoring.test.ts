import { describe, expect, it } from "vitest";
import { FaceAnalyzer, FaceTracker, iou } from "../../src/engine/analyzer";
import { combine } from "../../src/engine/scoring";
import type { SignalResult } from "../../src/engine/types";
import { naturalBlinks, synthFrames } from "./synth";

const sig = (id: SignalResult["id"], suspicion: number, confidence: number): SignalResult => ({ id, label: id, suspicion, confidence, detail: id, metrics: {} });

describe("combine", () => {
  it("says collecting until there is enough evidence", () => {
    expect(combine([sig("pulse", 1, 0.1)]).level).toBe("collecting");
  });

  it("maps scores to levels", () => {
    const all = (s: number) => (["pulse", "pose", "texture", "blink", "flicker", "jitter"] as const).map((id) => sig(id, s, 0.9));
    expect(combine(all(0.1)).level).toBe("low");
    expect(combine(all(0.45)).level).toBe("elevated");
    expect(combine(all(0.9)).level).toBe("high");
  });

  it("raises a flag for one strong, well-supported tell", () => {
    const r = combine([sig("pulse", 0.05, 0.9), sig("blink", 0.05, 0.9), sig("texture", 0.95, 0.8), sig("jitter", 0, 0.9)]);
    expect(r.level).toBe("elevated");
    expect(r.reasons[0]).toBe("texture");
  });

  it("a clean-looking face with no signs of life is still flagged", () => {
    const r = combine([sig("pulse", 0.75, 0.5), sig("blink", 0.15, 0.3), sig("texture", 0, 0.3), sig("flicker", 0, 0.6), sig("jitter", 0, 0.4)]);
    expect(["elevated", "high"]).toContain(r.level);
  });

  it("sensitivity shifts the thresholds", () => {
    const s = [sig("pulse", 0.33, 0.9), sig("blink", 0.33, 0.9), sig("texture", 0.33, 0.9)];
    expect(combine(s, "relaxed").level).toBe("low");
    expect(combine(s, "strict").level).toBe("elevated");
  });
});

describe("end to end on synthetic people", () => {
  it("a living face reads as low risk", () => {
    const a = new FaceAnalyzer();
    for (const f of synthFrames({ seconds: 45, blinks: naturalBlinks(45) })) a.push(f);
    const r = a.assess(45, "balanced");
    expect(r.level).toBe("low");
  });

  it("a frozen photo replay reads as high risk", () => {
    const a = new FaceAnalyzer();
    for (const f of synthFrames({ seconds: 45, bpm: 0, blinks: [] })) a.push(f);
    expect(["high", "elevated"]).toContain(a.assess(45, "balanced").level);
  });

  it("a face swap reads as high risk", () => {
    const a = new FaceAnalyzer();
    for (const f of synthFrames({ seconds: 45, bpm: 0, blinks: naturalBlinks(45), innerToOuter: 0.55, flicker: 0.006, jitter: 0.03 })) a.push(f);
    expect(a.assess(45, "balanced").level).toBe("high");
  });

  it("keeps only the rolling window", () => {
    const a = new FaceAnalyzer();
    for (const f of synthFrames({ seconds: 90 })) a.push(f);
    expect(a.frames[a.frames.length - 1]!.t - a.frames[0]!.t).toBeLessThanOrEqual(60.1);
  });
});

describe("tracker", () => {
  it("keeps ids stable and remembers people who left", () => {
    const tr = new FaceTracker(2);
    const a = { x: 0, y: 0, w: 0.2, h: 0.3 };
    const b = { x: 0.6, y: 0, w: 0.2, h: 0.3 };
    expect(tr.assign([a, b], 0)).toEqual([1, 2]);
    expect(tr.assign([{ ...b, x: 0.61 }, { ...a, x: 0.01 }], 0.1)).toEqual([2, 1]);
    tr.assign([a], 5);
    expect(tr.active(5).map((t) => t.id)).toEqual([1]);
    expect(tr.all().map((t) => t.id)).toEqual([1, 2]);
    expect(iou(a, a)).toBe(1);
  });
});

describe("audit regressions", () => {
  it("the head-turn check result survives the rolling window", () => {
    const a = new FaceAnalyzer();
    const yaw = (t: number) => (t % 6 < 3 ? 0 : 40);
    const check = synthFrames({ seconds: 12, yaw, jitterAtYaw: (y) => (y > 20 ? 0.03 : 0.005) });
    for (const f of check) a.push(f, true);
    for (const f of synthFrames({ seconds: 100, seed: 9 }).map((f) => ({ ...f, t: f.t + 12 }))) a.push(f);
    const pose = a.assess(112, "balanced").signals.find((s) => s.id === "pose")!;
    expect(pose.confidence).toBeGreaterThan(0.4);
    expect(pose.suspicion).toBeGreaterThan(0.8);
  });

  it("a person who steps away briefly keeps their number; memory of people who left is released", () => {
    const tr = new FaceTracker();
    const box = { x: 0.3, y: 0.2, w: 0.2, h: 0.3 };
    expect(tr.assign([box], 0)).toEqual([1]);
    expect(tr.assign([box], 10)).toEqual([1]); // back after 10 s
    const a = tr.analyzer(1)!;
    a.push(synthFrames({ seconds: 2 })[0]!);
    tr.assign([], 40); // gone for good
    expect(tr.all().map((p) => p.id)).toEqual([1]);
    expect(a.frames.length).toBe(0);
  });
});
