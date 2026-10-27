import { describe, expect, it } from "vitest";
import { WAVE_REFRESH_MS, WAVE_REFRESH_REDUCED_MS, waveformPath } from "../../src/ui/waveform";

describe("waveformPath", () => {
  it("draws nothing without a usable signal", () => {
    expect(waveformPath([], 100, 40)).toBe("");
    expect(waveformPath([1], 100, 40)).toBe("");
    expect(waveformPath([0, 0, 0], 100, 40)).toBe("");
    expect(waveformPath([1, Number.NaN, 2], 100, 40)).toBe("");
    expect(waveformPath([1, 2, 3], 0, 40)).toBe("");
  });

  it("spans the full width, starting with a move command", () => {
    const d = waveformPath([0, 1, 0, -1, 0], 100, 40);
    expect(d.startsWith("M0.0,")).toBe(true);
    expect(d).toContain("L100.0,");
    expect(d.match(/[ML]/g)).toHaveLength(5);
  });

  it("scales by the peak and keeps the line inside the padded box", () => {
    const ys = (d: string) => [...d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    const strong = ys(waveformPath([-5, 5, -5, 5], 100, 40, 3));
    const faint = ys(waveformPath([-0.001, 0.001, -0.001, 0.001], 100, 40, 3));
    expect(Math.min(...strong)).toBeCloseTo(3, 1);
    expect(Math.max(...strong)).toBeCloseTo(37, 1);
    expect(faint).toEqual(strong);
  });

  it("puts positive values above the centre line", () => {
    const d = waveformPath([0, 1, 0], 100, 40, 3);
    expect(d).toContain("L50.0,3.0");
  });

  it("redraws about ten times a second, and only once a second for reduced motion", () => {
    expect(WAVE_REFRESH_MS).toBe(100);
    expect(WAVE_REFRESH_REDUCED_MS).toBeGreaterThanOrEqual(1000);
  });
});
