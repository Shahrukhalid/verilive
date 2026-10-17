import { describe, expect, it } from "vitest";
import { bandpass, detrend, dominantPeak, fft, median, pearson, powerSpectrum, ramp, resampleUniform } from "../../src/engine/dsp";

describe("dsp", () => {
  it("fft round-trips", () => {
    const re = Float64Array.from([1, 2, 3, 4, 0, -1, -2, 5]);
    const im = new Float64Array(8);
    const orig = Array.from(re);
    fft(re, im);
    fft(re, im, true);
    re.forEach((v, i) => expect(v).toBeCloseTo(orig[i]!, 9));
  });

  it("finds the dominant frequency with a high SNR", () => {
    const fs = 15;
    const xs = Array.from({ length: fs * 20 }, (_, i) => Math.sin(2 * Math.PI * 1.25 * (i / fs)));
    const p = dominantPeak(powerSpectrum(xs, fs), 0.7, 3);
    expect(p.freq).toBeCloseTo(1.25, 1);
    expect(p.snrDb).toBeGreaterThan(5);
  });

  it("band-pass removes out-of-band components", () => {
    const fs = 15;
    const slow = Array.from({ length: 300 }, (_, i) => 5 * Math.sin(2 * Math.PI * 0.1 * (i / fs)));
    const out = bandpass(slow, fs, 0.7, 3);
    expect(Math.max(...out.slice(50, 250).map(Math.abs))).toBeLessThan(0.6);
  });

  it("resamples irregular samples onto a uniform grid", () => {
    const t = [0, 0.1, 0.35, 0.4, 1];
    const v = t.map((x) => 2 * x);
    const out = resampleUniform(t, v, 10);
    expect(out).toHaveLength(11);
    out.forEach((x, i) => expect(x).toBeCloseTo(2 * (i / 10), 9));
  });

  it("detrends, correlates and ramps", () => {
    expect(Math.max(...detrend([1, 2, 3, 4]).map(Math.abs))).toBeLessThan(1e-9);
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 9);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 9);
    expect(ramp(5, 0, 10)).toBe(0.5);
    expect(ramp(5, 10, 0)).toBe(0.5);
    expect(ramp(20, 0, 10)).toBe(1);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
