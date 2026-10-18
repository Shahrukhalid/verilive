import type { ReactNode } from "react";
import { useI18n } from "../i18n/react";
import type { SourceKind } from "./report";
import { ArrowIcon, CameraIcon, CheckIcon, EyeIcon, FileIcon, HeartIcon, LayersIcon, LockIcon, ScreenIcon, TurnIcon, WaveIcon } from "./icons";

const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

export function Home({ onStart, error, busy = false }: { onStart: (kind: SourceKind, file?: File) => void; error: string | null; busy?: boolean }) {
  const { t } = useI18n();
  return (
    <main>
      <div className="wrap">
        <section className="hero">
          <span className="eyebrow">{t("home.eyebrow")}</span>
          <h1>
            {t("home.titleLead")} <em>{t("home.titleEmphasis")}</em>
          </h1>
          <p className="lead">{t("home.lead")}</p>
          <div className="trust">
            <span><CheckIcon /> {t("home.trust.private")}</span>
            <span><CheckIcon /> {t("home.trust.noAccount")}</span>
            <span><CheckIcon /> {t("home.trust.free")}</span>
          </div>
        </section>

        {error && (
          <div className="card error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="starts">
          <StartCard
            primary
            icon={<ScreenIcon />}
            title={t("home.screen.title")}
            text={canShare ? t("home.screen.text") : t("home.screen.unsupported")}
            cta={t("home.screen.cta")}
            disabled={!canShare || busy}
            onClick={() => onStart("screen")}
            testId="start-screen"
          />
          <label className="start" data-testid="start-file">
            <span className="ico"><FileIcon /></span>
            <h2>{t("home.file.title")}</h2>
            <p>{t("home.file.text")}</p>
            <span className="go">{t("home.file.cta")} <ArrowIcon width={16} /></span>
            <input
              className="sr-only"
              type="file"
              accept="video/*"
              disabled={busy}
              aria-label={t("home.file.aria")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onStart("file", f);
                e.target.value = "";
              }}
            />
          </label>
          <StartCard icon={<CameraIcon />} title={t("home.camera.title")} text={t("home.camera.text")} cta={t("home.camera.cta")} onClick={() => onStart("camera")} disabled={busy} testId="start-camera" />
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <h2>{t("home.how.title")}</h2>
          <div className="grid3">
            <Step n="01" title={t("home.step1.title")}>{t("home.step1.text")}</Step>
            <Step n="02" title={t("home.step2.title")}>{t("home.step2.text")}</Step>
            <Step n="03" title={t("home.step3.title")}>{t("home.step3.text")}</Step>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid2">
          <div>
            <h2>{t("home.tells.title")}</h2>
            <div className="tells">
              <Tell icon={<HeartIcon />} title={t("home.tell.pulse.title")}>{t("home.tell.pulse.text")}</Tell>
              <Tell icon={<EyeIcon />} title={t("home.tell.blink.title")}>{t("home.tell.blink.text")}</Tell>
              <Tell icon={<LayersIcon />} title={t("home.tell.paste.title")}>{t("home.tell.paste.text")}</Tell>
              <Tell icon={<WaveIcon />} title={t("home.tell.shape.title")}>{t("home.tell.shape.text")}</Tell>
              <Tell icon={<TurnIcon />} title={t("home.tell.turn.title")}>{t("home.tell.turn.text")}</Tell>
            </div>
          </div>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div className="card">
              <h3><LockIcon width={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />{t("home.privacy.title")}</h3>
              <p>{t("home.privacy.text")}</p>
            </div>
            <div className="note">
              <b>{t("home.note.lead")}</b> {t("home.note.text")}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function StartCard(props: { icon: ReactNode; title: string; text: string; cta: string; onClick: () => void; primary?: boolean; disabled?: boolean; testId: string }) {
  return (
    <button className={`start${props.primary ? " primary" : ""}`} onClick={props.onClick} disabled={props.disabled} data-testid={props.testId}>
      <span className="ico">{props.icon}</span>
      <h2>{props.title}</h2>
      <p>{props.text}</p>
      <span className="go">{props.cta} <ArrowIcon width={16} /></span>
    </button>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="card">
      <span className="step-n">{n}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function Tell({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="tell">
      <span className="dot">{icon}</span>
      <div>
        <b>{title}</b>
        <span>{children}</span>
      </div>
    </div>
  );
}
