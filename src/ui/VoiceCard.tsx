import type { VoiceView } from "../audio/voiceMonitor";
import { useI18n } from "../i18n/react";

/**
 * The experimental voice reading. It is a separate card on purpose: it never changes the face
 * verdict, and it says in plain words that nobody has checked it against real calls yet.
 */
export function VoiceCard({ available, view }: { available: boolean; view: VoiceView | null }) {
  const { t } = useI18n();
  const snap = view?.snapshot ?? null;
  const status = !available ? "unavailable" : (view?.status ?? "starting");
  const seconds = Math.round(snap?.speechSeconds ?? 0);
  let text: string;
  if (status === "unavailable") text = t("voice.state.unavailable");
  else if (status === "noAudio") text = t("voice.state.noAudio");
  else if (status === "error") text = t("voice.state.error");
  else if (!snap || snap.level === "collecting") text = t("voice.state.listening", { seconds });
  else text = t(snap.level === "some" ? "voice.state.some" : "voice.state.low");
  const measured = snap && snap.level !== "collecting";
  const percent = Math.round((snap?.suspicion ?? 0) * 100);
  return (
    <section className="card" data-testid="voice-card" aria-label={t("voice.title")}>
      <div className="panel-title">{t("voice.title")}</div>
      <p data-testid="voice-text" aria-live="polite">{text}</p>
      {measured && (
        <div className="evidence">
          <span>{t("voice.score", { percent })}</span>
          <div className="meter" role="progressbar" aria-label={t("voice.meterAria")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <i style={{ width: `${percent}%`, background: percent < 35 ? "var(--ok)" : percent < 65 ? "var(--warn)" : "var(--bad)" }} />
          </div>
        </div>
      )}
      {snap && snap.speechSeconds > 0 && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t("voice.heard", { seconds })}</p>}
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t("voice.caveat")}</p>
    </section>
  );
}
