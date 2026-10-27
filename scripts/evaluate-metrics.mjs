// Pure helpers for scripts/evaluate.mjs: labels, predictions and metrics. No I/O, so they are unit-tested.

export const LEVEL_RANK = { collecting: 0, low: 1, elevated: 2, high: 3 };

/** Accepts "real"/"fake" and a few common spellings. Returns null for anything else. */
export function normalizeLabel(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (["real", "genuine", "authentic", "live", "0"].includes(v)) return "real";
  if (["fake", "deepfake", "synthetic", "manipulated", "1"].includes(v)) return "fake";
  return null;
}

/** Splits one CSV line, honouring double quotes. */
export function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parses "path,label" rows (header optional). Returns { rows: [{ path, label }], errors: string[] }. */
export function parseLabelsCsv(text) {
  const rows = [];
  const errors = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  lines.forEach((line, i) => {
    const [path, label] = parseCsvLine(line);
    if (i === 0 && /^(path|file|filename|video)$/i.test(path ?? "")) return;
    const norm = normalizeLabel(label);
    if (!path || !norm) errors.push(`line ${i + 1}: expected "path,real|fake", got "${line}"`);
    else rows.push({ path, label: norm });
  });
  return { rows, errors };
}

/**
 * One verdict per video: the worst-rated person. A video counts as "fake" when that person
 * reaches `threshold` ("elevated" or "high"). Videos where no person got a reading are `null`.
 */
export function classify(people, threshold = "elevated") {
  const rated = (people ?? []).filter((p) => p.level !== "collecting");
  if (!rated.length) return { predicted: null, worstLevel: "collecting", score: null };
  const worst = rated.reduce((w, p) => (LEVEL_RANK[p.level] > LEVEL_RANK[w.level] || (p.level === w.level && p.score > w.score) ? p : w));
  return { predicted: LEVEL_RANK[worst.level] >= LEVEL_RANK[threshold] ? "fake" : "real", worstLevel: worst.level, score: worst.score };
}

const ratio = (a, b) => (b > 0 ? a / b : null);

/** Confusion matrix and headline metrics. "fake" is the positive class. Rows with no prediction are skipped. */
export function summarize(rows) {
  const m = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const r of rows) {
    if (!r.predicted) continue;
    if (r.label === "fake") m[r.predicted === "fake" ? "tp" : "fn"]++;
    else m[r.predicted === "fake" ? "fp" : "tn"]++;
  }
  const n = m.tp + m.fp + m.tn + m.fn;
  const precision = ratio(m.tp, m.tp + m.fp);
  const recall = ratio(m.tp, m.tp + m.fn);
  return {
    ...m,
    evaluated: n,
    unrated: rows.length - n,
    accuracy: ratio(m.tp + m.tn, n),
    precision,
    recall,
    specificity: ratio(m.tn, m.tn + m.fp),
    f1: precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null,
  };
}

/**
 * Per-signal numbers. For every video each signal takes its highest suspicion among people
 * whose confidence for it is at least `minConfidence`; a video with none counts as "not measured".
 * `flagAt` turns that suspicion into a yes/no so precision and recall can be reported per signal.
 */
export function signalStats(videos, { flagAt = 0.5, minConfidence = 0.25 } = {}) {
  const ids = [...new Set(videos.flatMap((v) => (v.people ?? []).flatMap((p) => p.signals.map((s) => s.id))))];
  return ids.map((id) => {
    const per = videos.map((v) => {
      const vals = (v.people ?? []).flatMap((p) => p.signals.filter((s) => s.id === id && s.confidence >= minConfidence).map((s) => s.suspicion));
      return { label: v.label, suspicion: vals.length ? Math.max(...vals) : null };
    });
    const measured = per.filter((x) => x.suspicion !== null);
    const mean = (label) => {
      const xs = measured.filter((x) => x.label === label).map((x) => x.suspicion);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    const s = summarize(measured.map((x) => ({ label: x.label, predicted: x.suspicion >= flagAt ? "fake" : "real" })));
    return {
      signal: id,
      measured: measured.length,
      coverage: ratio(measured.length, per.length),
      meanSuspicionReal: mean("real"),
      meanSuspicionFake: mean("fake"),
      precision: s.precision,
      recall: s.recall,
      accuracy: s.accuracy,
    };
  });
}
