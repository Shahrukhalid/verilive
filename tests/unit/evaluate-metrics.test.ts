import { describe, expect, it } from "vitest";
import { classify, normalizeLabel, parseLabelsCsv, signalStats, summarize, type PersonLike } from "../../scripts/evaluate-metrics.mjs";

const person = (level: string, score: number, signals: PersonLike["signals"] = []): PersonLike => ({ level, score, signals });

describe("labels", () => {
  it("normalizes spellings and rejects unknown ones", () => {
    expect(normalizeLabel(" Real ")).toBe("real");
    expect(normalizeLabel("deepfake")).toBe("fake");
    expect(normalizeLabel("1")).toBe("fake");
    expect(normalizeLabel("maybe")).toBeNull();
  });

  it("parses a CSV with or without a header, comments and quotes", () => {
    const { rows, errors } = parseLabelsCsv('path,label\n# note\na/one.mp4,real\n"b, two.mp4",FAKE\nbad.mp4,unknown\n');
    expect(rows).toEqual([
      { path: "a/one.mp4", label: "real" },
      { path: "b, two.mp4", label: "fake" },
    ]);
    expect(errors).toHaveLength(1);
    expect(parseLabelsCsv("x.mp4,fake").rows).toHaveLength(1);
  });
});

describe("classify", () => {
  it("uses the worst-rated person and the chosen threshold", () => {
    const people = [person("low", 0.1), person("elevated", 0.5), person("collecting", 0)];
    expect(classify(people)).toEqual({ predicted: "fake", worstLevel: "elevated", score: 0.5 });
    expect(classify(people, "high").predicted).toBe("real");
  });

  it("returns no prediction when nobody got a reading", () => {
    expect(classify([person("collecting", 0)]).predicted).toBeNull();
    expect(classify([]).predicted).toBeNull();
  });
});

describe("summarize", () => {
  it("computes the confusion matrix with fake as the positive class", () => {
    const s = summarize([
      { label: "fake", predicted: "fake" },
      { label: "fake", predicted: "fake" },
      { label: "fake", predicted: "real" },
      { label: "real", predicted: "real" },
      { label: "real", predicted: "fake" },
      { label: "real", predicted: null },
    ]);
    expect([s.tp, s.fn, s.tn, s.fp, s.evaluated, s.unrated]).toEqual([2, 1, 1, 1, 5, 1]);
    expect(s.accuracy).toBeCloseTo(3 / 5);
    expect(s.precision).toBeCloseTo(2 / 3);
    expect(s.recall).toBeCloseTo(2 / 3);
    expect(s.specificity).toBeCloseTo(1 / 2);
    expect(s.f1).toBeCloseTo(2 / 3);
  });

  it("reports null instead of dividing by zero", () => {
    const s = summarize([{ label: "real", predicted: "real" }]);
    expect(s.precision).toBeNull();
    expect(s.recall).toBeNull();
    expect(s.f1).toBeNull();
    expect(s.accuracy).toBe(1);
  });
});

describe("signalStats", () => {
  const sig = (suspicion: number, confidence = 0.9) => [{ id: "pulse", suspicion, confidence }];
  it("ignores low-confidence readings and averages per label", () => {
    const stats = signalStats([
      { label: "fake", people: [person("high", 0.9, sig(0.9))] },
      { label: "fake", people: [person("low", 0.1, sig(0.1, 0.1))] },
      { label: "real", people: [person("low", 0.1, sig(0.2))] },
      { label: "real", people: [person("low", 0.1, sig(0.6))] },
    ]);
    const pulse = stats[0]!;
    expect(pulse.measured).toBe(3);
    expect(pulse.coverage).toBeCloseTo(3 / 4);
    expect(pulse.meanSuspicionFake).toBeCloseTo(0.9);
    expect(pulse.meanSuspicionReal).toBeCloseTo(0.4);
    expect(pulse.recall).toBe(1);
    expect(pulse.precision).toBeCloseTo(1 / 2);
  });
});
