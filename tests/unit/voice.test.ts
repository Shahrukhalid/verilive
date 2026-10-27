import { describe, expect, it } from "vitest";
import { FRAME, FEATURE_COUNT, VoiceAggregator, analyzeFrame, arrayToFrame, frameToArray, isVoiced, type FrameFeatures } from "../../src/audio/features";
import { voiceReport } from "../../src/ui/report";

/** Small deterministic random numbers, so the tests do not flake. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

const tone = (hz: number, sr: number, amp = 0.3, n = FRAME) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr));
const whiteNoise = (seed: number, amp = 0.1, n = FRAME) => {
  const r = rng(seed);
  return Float32Array.from({ length: n }, () => amp * gauss(r));
};
/** Noise with energy only below `cutoffHz`, made from random-phase sinusoids. */
function bandLimitedNoise(seed: number, sr: number, cutoffHz: number, amp = 0.05, n = FRAME) {
  const r = rng(seed);
  const parts = Array.from({ length: 120 }, () => ({ f: 100 + r() * (cutoffHz - 100), p: r() * 2 * Math.PI }));
  return Float32Array.from({ length: n }, (_, i) => (amp * parts.reduce((s, c) => s + Math.sin((2 * Math.PI * c.f * i) / sr + c.p), 0)) / Math.sqrt(parts.length / 2));
}

describe("frame features", () => {
  const sr = 16000;

  it("a pure tone is tonal (flatness near 0), voiced at its pitch, and rolls off just above it", () => {
    const { features: f } = analyzeFrame(tone(220, sr), sr);
    expect(f.flatness).toBeLessThan(0.05);
    expect(f.f0).toBeGreaterThan(215);
    expect(f.f0).toBeLessThan(225);
    expect(f.voicing).toBeGreaterThan(0.8);
    expect(f.rolloffHz).toBeLessThan(400);
    expect(isVoiced(f)).toBe(true);
  });

  it("white noise is flat, has energy up to the top, and has no pitch", () => {
    const { features: f } = analyzeFrame(whiteNoise(1), sr);
    expect(f.flatness).toBeGreaterThan(0.3);
    expect(f.rolloffHz).toBeGreaterThan(6500);
    expect(f.f0).toBe(0);
    expect(isVoiced(f)).toBe(false);
  });

  it("band-limited noise rolls off at its cutoff and has no energy in the high band", () => {
    const wide = 48000;
    const limited = analyzeFrame(bandLimitedNoise(2, wide, 4000), wide).features;
    const full = analyzeFrame(whiteNoise(3, 0.1), wide).features;
    expect(limited.rolloffHz).toBeGreaterThan(3000);
    expect(limited.rolloffHz).toBeLessThan(4300);
    expect(limited.highBandRatio).toBeLessThan(1e-4);
    expect(full.highBandRatio).toBeGreaterThan(0.5);
    expect(limited.flatness).toBeLessThan(full.flatness);
  });

  it("finds pitch across the speech range at both common sample rates", () => {
    for (const rate of [16000, 48000]) {
      for (const hz of [90, 140, 260, 380]) {
        const { features: f } = analyzeFrame(tone(hz, rate), rate);
        expect(Math.abs(f.f0 - hz) / hz, `${hz} Hz at ${rate}`).toBeLessThan(0.03);
      }
    }
  });

  it("finds the pitch of a harmonic voice-like signal, not its overtones", () => {
    const voice = Float32Array.from({ length: FRAME }, (_, i) => [1, 0.6, 0.4, 0.25].reduce((s, a, k) => s + a * Math.sin((2 * Math.PI * 150 * (k + 1) * i) / 48000), 0) * 0.1);
    const { features: f } = analyzeFrame(voice, 48000);
    expect(Math.abs(f.f0 - 150)).toBeLessThan(5);
  });

  it("silence is not voiced and has no flatness, rolloff or flux", () => {
    const { features: f } = analyzeFrame(new Float32Array(FRAME), sr);
    expect(f).toMatchObject({ rms: 0, flatness: 0, rolloffHz: 0, flux: 0, f0: 0 });
  });

  it("measures level as RMS", () => {
    expect(analyzeFrame(tone(300, sr, 0.5), sr).features.rms).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("spectral flux is zero for an unchanging signal and large when the spectrum changes", () => {
    const a = analyzeFrame(tone(300, sr), sr);
    const same = analyzeFrame(tone(300, sr), sr, a.spectrum);
    const changed = analyzeFrame(whiteNoise(4), sr, a.spectrum);
    expect(a.features.flux).toBe(0);
    expect(same.features.flux).toBeLessThan(0.01);
    expect(changed.features.flux).toBeGreaterThan(0.3);
  });

  it("round-trips through the flat array the worklet sends", () => {
    const f = analyzeFrame(tone(200, sr), sr).features;
    const flat = frameToArray(f);
    expect(flat).toHaveLength(FEATURE_COUNT);
    expect(arrayToFrame([9, ...flat], 1)).toEqual(f);
  });
});

/** A voiced frame with the given pitch and level, and plausible other numbers. */
const voicedFrame = (f0: number, rms: number, over: Partial<FrameFeatures> = {}): FrameFeatures => ({ rms, flatness: 0.1, rolloffHz: 4000, highBandRatio: 0.01, flux: 0.2, f0, voicing: 0.9, ...over });

describe("voice aggregator", () => {
  const sr = 48000;

  it("says nothing until enough speech has been heard", () => {
    const agg = new VoiceAggregator(sr);
    expect(agg.snapshot()).toMatchObject({ level: "collecting", metrics: null, speechSeconds: 0, confidence: 0 });
    for (let i = 0; i < 50; i++) agg.add(voicedFrame(150, 0.1));
    const s = agg.snapshot();
    expect(s.level).toBe("collecting");
    expect(s.speechSeconds).toBeCloseTo((50 * FRAME) / sr, 5);
    expect(s.confidence).toBeLessThan(0.4);
  });

  it("silence and noise do not count as speech", () => {
    const agg = new VoiceAggregator(sr);
    for (let i = 0; i < 600; i++) agg.add(voicedFrame(0, 0.1, { voicing: 0.1 }));
    for (let i = 0; i < 600; i++) agg.add(voicedFrame(150, 0.0005));
    expect(agg.snapshot().speechSeconds).toBe(0);
    expect(agg.snapshot().level).toBe("collecting");
  });

  function run(makeFrame: (i: number) => FrameFeatures, frames = 700) {
    const agg = new VoiceAggregator(sr);
    for (let i = 0; i < frames; i++) agg.add(makeFrame(i));
    return agg.snapshot();
  }

  it("rates machine-even speech (fixed pitch, fixed level, no high band) higher than lively speech", () => {
    const r = rng(7);
    const even = run((i) => voicedFrame(150, 0.1, { highBandRatio: 1e-6, flux: 0.2 + 0.001 * (i % 2) }));
    let pitch = 150;
    let level = 0.1;
    const lively = run(() => {
      pitch *= 1 + 0.02 * gauss(r);
      pitch = Math.min(300, Math.max(90, pitch));
      level = Math.min(0.3, Math.max(0.02, level * (1 + 0.25 * gauss(r))));
      return voicedFrame(pitch, level, { highBandRatio: 0.01, flux: 0.1 + 0.2 * r() });
    });
    expect(even.level).toBe("some");
    expect(lively.level).toBe("low");
    expect(even.suspicion).toBeGreaterThan(0.8);
    expect(lively.suspicion).toBeLessThan(0.3);
    expect(even.confidence).toBe(1);
    expect(even.metrics!.pitchStepSemitones).toBeLessThan(0.01);
  });

  it("ignores the high-band trait when the stream is too narrow to hold a high band", () => {
    const r = rng(8);
    const narrow = new VoiceAggregator(16000);
    let pitch = 150;
    for (let i = 0; i < 500; i++) {
      pitch = Math.min(300, Math.max(90, pitch * (1 + 0.02 * gauss(r))));
      narrow.add(voicedFrame(pitch, 0.05 + 0.1 * r(), { highBandRatio: 0, flux: 0.1 + 0.2 * r() }));
    }
    expect(narrow.snapshot().level).toBe("low");
  });

  it("keeps only a bounded window of numbers", () => {
    const agg = new VoiceAggregator(sr, 100);
    for (let i = 0; i < 1000; i++) agg.add(voicedFrame(150, 0.1));
    expect((agg as unknown as { frames: unknown[] }).frames.length).toBe(100);
    expect(agg.snapshot().analyzedSeconds).toBeCloseTo((1000 * FRAME) / sr, 5);
  });

  it("drops malformed worklet messages instead of poisoning the state", () => {
    const agg = new VoiceAggregator(sr);
    agg.addFlat([0.1, 0.1, 4000, 0.01, 0.2, 150, 0.9, NaN, 1, 2, 3, 4, 5, 6, 1, 2]);
    expect(agg.snapshot().analyzedSeconds).toBeCloseTo(FRAME / sr, 5);
  });

  it("the report holds numbers only", () => {
    const rep = voiceReport(run(() => voicedFrame(150, 0.1)));
    const walk = (v: unknown): void => {
      if (v && typeof v === "object") Object.values(v).forEach(walk);
      else expect(typeof v).toBe("number");
    };
    walk(rep);
    expect(Object.keys(rep).sort()).toEqual(["analyzedSeconds", "confidence", "metrics", "speechSeconds", "suspicion"]);
  });
});
