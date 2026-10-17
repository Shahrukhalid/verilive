import type { FaceTracker } from "../engine/analyzer";
import type { Sensitivity } from "../engine/types";
import { formatMessage, formatSignalDetail, type Copy } from "./i18n";

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
export function buildReport(info: SessionInfo, tracker: FaceTracker, copy: Copy) {
  return {
    tool: "Verilive",
    version: APP_VERSION,
    note: copy.app.riskNote,
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
          verdict: copy.levels[a.level].title,
          score: round(a.score),
          confidence: round(a.confidence),
          reasons: a.reasons.map((reason) => formatSignalDetail(copy, reason)),
          signals: a.signals.map((s) => ({ id: s.id, label: copy.signalLabels[s.id], suspicion: round(s.suspicion), confidence: round(s.confidence), detail: formatSignalDetail(copy, s.detail), metrics: s.metrics })),
          timeline: analyzer.timeline.map((p) => ({ t: round(p.t, 1), score: round(p.score), confidence: round(p.confidence) })),
        };
      }),
  };
}

export type Report = ReturnType<typeof buildReport>;

export function summaryText(r: Report, copy: Copy): string {
  const lines = [formatMessage(copy.report.header, {
    date: new Date(r.startedAt).toLocaleString(copy.locale),
    minutes: Math.round(r.durationSeconds / 60),
    source: r.source.label,
  })];
  if (!r.people.length) lines.push(copy.report.noFaces);
  for (const p of r.people) {
    lines.push(`${formatMessage(copy.report.person, { person: p.person, verdict: p.verdict })} (${formatMessage(copy.report.risk, { percent: Math.round(p.score * 100) })}, ${formatMessage(copy.report.evidence, { percent: Math.round(p.confidence * 100) })})`);
    for (const reason of p.reasons) lines.push(`  - ${reason}`);
  }
  lines.push(r.note);
  return lines.join("\n");
}

function round(x: number, d = 3): number {
  const k = 10 ** d;
  return Math.round(x * k) / k;
}
