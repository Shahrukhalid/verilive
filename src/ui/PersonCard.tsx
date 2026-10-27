import { useEffect, useRef, useState } from "react";
import type { TimelinePoint } from "../engine/analyzer";
import type { Assessment, RiskLevel, SignalResult } from "../engine/types";
import { WAVE_SECONDS } from "../engine/pulse";
import { useI18n } from "../i18n/react";
import { WAVE_REFRESH_MS, WAVE_REFRESH_REDUCED_MS, waveformPath } from "./waveform";

export const LEVEL_COLOR: Record<RiskLevel, string> = {
  collecting: "var(--idle)",
  low: "var(--ok)",
  elevated: "var(--warn)",
  high: "var(--bad)",
};

export function PersonCard({ id, assessment, timeline, onScreen, wave }: { id: number; assessment: Assessment; timeline: TimelinePoint[]; onScreen: boolean; wave?: number[] }) {
  const { t } = useI18n();
  const { level, score, confidence, reasonIds, signals } = assessment;
  const title = t(`level.${level}.title`);
  const detail = (s: SignalResult) => (s.detailKey ? t(s.detailKey, s.detailParams) : s.detail);
  const reasons = reasonIds.flatMap((rid) => signals.filter((s) => s.id === rid).map(detail));
  return (
    <article className="card person" data-testid={`person-${id}`} aria-label={t("person.aria", { id, title })}>
      <div className="person-head">
        <Gauge level={level} score={score} />
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <h3>{t("person.title", { id })}{onScreen ? "" : <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}> · {t("person.left")}</span>}</h3>
          <span className={`level lv-${level}`} data-testid="level">{title}</span>
        </div>
      </div>
      <p className="advice">{t(`level.${level}.advice`)}</p>
      <div className="evidence">
        <span>{t("person.evidence", { percent: Math.round(confidence * 100) })}</span>
        <div className="meter" role="progressbar" aria-label={t("person.evidenceAria")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(confidence * 100)}>
          <i style={{ width: `${Math.round(confidence * 100)}%` }} />
        </div>
      </div>
      {level !== "collecting" && reasons.length > 0 && (
        <ul className="reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {wave && wave.length > 1 && (signals.find((s) => s.id === "pulse")?.confidence ?? 0) > 0 && <PulseWave samples={wave} />}
      {timeline.length > 2 && <Sparkline points={timeline} />}
      <details className="signals">
        <summary>{t("person.allSignals")}</summary>
        {signals.map((s) => (
          <div className="sig" key={s.id}>
            <span className="name">{t(`signal.${s.id}`)}</span>
            <span className="val">{s.confidence === 0 ? t("person.waiting") : s.confidence < 0.25 ? t("person.weak") : t("person.risk", { percent: Math.round(s.suspicion * 100) })}</span>
            <div className="meter" aria-hidden="true">
              <i style={{ width: `${Math.round(s.suspicion * 100)}%`, background: s.suspicion < 0.35 ? "var(--ok)" : s.suspicion < 0.65 ? "var(--warn)" : "var(--bad)", opacity: 0.35 + 0.65 * s.confidence }} />
            </div>
            <p>{detail(s)}</p>
          </div>
        ))}
      </details>
    </article>
  );
}

function Gauge({ level, score }: { level: RiskLevel; score: number }) {
  const { t } = useI18n();
  const r = 30;
  const c = 2 * Math.PI * r;
  const shown = level === "collecting" ? 0.08 : Math.max(0.04, score);
  return (
    <svg className="gauge" viewBox="0 0 76 76" role="img" aria-label={level === "collecting" ? t("gauge.analyzing") : t("gauge.risk", { percent: Math.round(score * 100) })}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke={LEVEL_COLOR[level]}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${shown * c} ${c}`}
        transform="rotate(-90 38 38)"
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
      <text x="38" y="44" textAnchor="middle">{level === "collecting" ? "…" : Math.round(score * 100)}</text>
    </svg>
  );
}

function Sparkline({ points }: { points: TimelinePoint[] }) {
  const { t } = useI18n();
  const W = 300;
  const H = 44;
  const t0 = points[0]!.t;
  const t1 = points[points.length - 1]!.t || 1;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W;
  const y = (s: number) => H - 4 - s * (H - 8);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.score).toFixed(1)}`).join("");
  const last = points[points.length - 1]!;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("spark.aria")}>
      <line x1="0" x2={W} y1={y(0.35)} y2={y(0.35)} stroke="var(--line)" strokeDasharray="3 4" />
      <line x1="0" x2={W} y1={y(0.6)} y2={y(0.6)} stroke="var(--line)" strokeDasharray="3 4" />
      <path d={`${d}L${x(last.t)},${H}L0,${H}Z`} fill="var(--brand-soft)" />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.t)} cy={y(last.score)} r="3.5" fill="var(--brand)" />
    </svg>
  );
}

/** Shows `value`, but updates at most once per `ms` so a busy parent does not make it redraw constantly. */
function usePaced<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = ms - (performance.now() - last.current);
    const id = window.setTimeout(() => {
      last.current = performance.now();
      setShown(value);
    }, Math.max(0, wait));
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return shown;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** The recent pulse (POS) waveform, already computed by the detector; redrawn at about 10 fps at most. */
function PulseWave({ samples }: { samples: number[] }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const shown = usePaced(samples, reduced ? WAVE_REFRESH_REDUCED_MS : WAVE_REFRESH_MS);
  const d = waveformPath(shown, 300, 40);
  if (!d) return null;
  return (
    <figure className="pulsewave">
      <figcaption>{t("wave.label")}</figcaption>
      <svg viewBox="0 0 300 40" preserveAspectRatio="none" role="img" aria-label={t("wave.aria", { seconds: WAVE_SECONDS })}>
        <line x1="0" x2="300" y1="20" y2="20" stroke="var(--line)" strokeDasharray="3 4" />
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    </figure>
  );
}
