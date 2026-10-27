import type { FaceTracker } from "../engine/analyzer";
import type { Sensitivity } from "../engine/types";
import type { VoiceSnapshot } from "../audio/features";
import { tEn, type Translate } from "../i18n";

export const APP_VERSION = "1.0.0";

export type SourceKind = "screen" | "file" | "camera";

export interface SessionInfo {
  kind: SourceKind;
  label: string;
  startedAt: Date;
  seconds: number;
  sensitivity: Sensitivity;
  /** The experimental voice reading, when that setting was on and tab audio was heard. */
  voice?: VoiceSnapshot | null;
}

/** Numbers only. Never audio, never words. It sits apart from the face results and does not feed their score. */
export function voiceReport(v: VoiceSnapshot) {
  return {
    speechSeconds: round(v.speechSeconds, 1),
    analyzedSeconds: round(v.analyzedSeconds, 1),
    suspicion: round(v.suspicion),
    confidence: round(v.confidence),
    metrics: v.metrics && {
      flatness: round(v.metrics.flatness),
      rolloffHz: Math.round(v.metrics.rolloffHz),
      highBandRatio: round(v.metrics.highBandRatio, 6),
      pitchStepSemitones: round(v.metrics.pitchStepSemitones),
      levelStep: round(v.metrics.levelStep),
      fluxVariation: round(v.metrics.fluxVariation),
    },
  };
}

/** A self-contained record of the session. Contains numbers only: no images or video. */
export function buildReport(info: SessionInfo, tracker: FaceTracker) {
  return {
    tool: "Verilive",
    version: APP_VERSION,
    note: tEn("report.note"),
    source: { kind: info.kind, label: info.label },
    startedAt: info.startedAt.toISOString(),
    durationSeconds: Math.round(info.seconds),
    sensitivity: info.sensitivity,
    ...(info.voice ? { experimental: { voice: voiceReport(info.voice) } } : {}),
    people: tracker
      .all()
      .filter(({ analyzer }) => analyzer.latest && (analyzer.latest.level !== "collecting" || analyzer.timeline.length > 0))
      .map(({ id, analyzer }) => {
        const a = analyzer.latest!;
        return {
          person: id,
          level: a.level,
          verdict: tEn(`level.${a.level}.title`),
          score: round(a.score),
          confidence: round(a.confidence),
          reasons: a.reasons,
          reasonIds: a.reasonIds,
          signals: a.signals.map((s) => ({ id: s.id, label: s.label, suspicion: round(s.suspicion), confidence: round(s.confidence), detail: s.detail, detailKey: s.detailKey, detailParams: s.detailParams, metrics: s.metrics })),
          timeline: analyzer.timeline.map((p) => ({ t: round(p.t, 1), score: round(p.score), confidence: round(p.confidence) })),
        };
      }),
  };
}

export type Report = ReturnType<typeof buildReport>;

/** The text a person copies to share. Unlike the saved JSON report, it is written in their language. */
export function summaryText(r: Report, t: Translate = tEn): string {
  const lines = [t("summary.header", { date: new Date(r.startedAt).toLocaleString(), minutes: Math.round(r.durationSeconds / 60), source: r.source.label })];
  if (!r.people.length) lines.push(t("summary.none"));
  for (const p of r.people) {
    const verdict = t(`level.${p.level}.title`);
    lines.push(t("summary.person", { id: p.person, verdict, risk: Math.round(p.score * 100), evidence: Math.round(p.confidence * 100) }));
    for (const id of p.reasonIds) {
      const s = p.signals.find((x) => x.id === id);
      if (s) lines.push(`  - ${s.detailKey ? t(s.detailKey, s.detailParams) : s.detail}`);
    }
  }
  lines.push(t("report.note"));
  return lines.join("\n");
}

function round(x: number, d = 3): number {
  const k = 10 ** d;
  return Math.round(x * k) / k;
}
