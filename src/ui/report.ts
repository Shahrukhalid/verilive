import type { FaceTracker } from "../engine/analyzer";
import { LEVEL_TEXT } from "../engine/scoring";
import type { Sensitivity } from "../engine/types";

export const APP_VERSION = "1.0.0";

export type SourceKind = "screen" | "file" | "camera";

export interface SessionInfo {
  kind: SourceKind;
  label: string;
  startedAt: Date;
  seconds: number;
  sensitivity: Sensitivity;
}

/** A self-contained record of the session. Contains numbers only: no images or video. */
export function buildReport(info: SessionInfo, tracker: FaceTracker) {
  return {
    tool: "Verilive",
    version: APP_VERSION,
    note: "Risk signals, not proof. Verify identity through another channel before acting.",
    source: { kind: info.kind, label: info.label },
    startedAt: info.startedAt.toISOString(),
    durationSeconds: Math.round(info.seconds),
    sensitivity: info.sensitivity,
    people: tracker
      .all()
      .filter(({ analyzer }) => analyzer.latest)
      .map(({ id, analyzer }) => {
        const a = analyzer.latest!;
        return {
          person: id,
          level: a.level,
          verdict: LEVEL_TEXT[a.level].title,
          score: round(a.score),
          confidence: round(a.confidence),
          reasons: a.reasons,
          signals: a.signals.map((s) => ({ id: s.id, label: s.label, suspicion: round(s.suspicion), confidence: round(s.confidence), detail: s.detail, metrics: s.metrics })),
          timeline: analyzer.timeline.map((p) => ({ t: round(p.t, 1), score: round(p.score), confidence: round(p.confidence) })),
        };
      }),
  };
}

export type Report = ReturnType<typeof buildReport>;

export function summaryText(r: Report): string {
  const lines = [`Verilive check · ${new Date(r.startedAt).toLocaleString()} · ${Math.round(r.durationSeconds / 60)} min · ${r.source.label}`];
  if (!r.people.length) lines.push("No faces were analyzed.");
  for (const p of r.people) {
    lines.push(`Person ${p.person}: ${p.verdict} (risk ${Math.round(p.score * 100)}%, evidence ${Math.round(p.confidence * 100)}%)`);
    for (const reason of p.reasons) lines.push(`  - ${reason}`);
  }
  lines.push(r.note);
  return lines.join("\n");
}

function round(x: number, d = 3): number {
  const k = 10 ** d;
  return Math.round(x * k) / k;
}
