import type { ReactNode } from "react";
import type { SourceKind } from "./report";
import { ArrowIcon, CameraIcon, CheckIcon, EyeIcon, FileIcon, HeartIcon, LayersIcon, LockIcon, ScreenIcon, TurnIcon, WaveIcon } from "./icons";
import type { Copy } from "./i18n";

const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

export function Home({ onStart, error, copy }: { onStart: (kind: SourceKind, file?: File) => void; error: string | null; copy: Copy }) {
  const home = copy.home;
  const icons = [<HeartIcon key="pulse" />, <EyeIcon key="blink" />, <LayersIcon key="texture" />, <WaveIcon key="shape" />, <TurnIcon key="turn" />];
  return (
    <main>
      <div className="wrap">
        <section className="hero">
          <span className="eyebrow">{home.eyebrow}</span>
          <h1>
            {home.title} <em>{home.titleEmphasis}</em>
          </h1>
          <p className="lead">{home.lead}</p>
          <div className="trust">
            {home.trust.map((text) => <span key={text}><CheckIcon /> {text}</span>)}
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
            title={home.liveCall.title}
            text={canShare ? home.liveCall.ready : home.liveCall.unavailable}
            cta={home.liveCall.cta}
            disabled={!canShare}
            onClick={() => onStart("screen")}
            testId="start-screen"
          />
          <label className="start" data-testid="start-file">
            <span className="ico"><FileIcon /></span>
            <h2>{home.recording.title}</h2>
            <p>{home.recording.body}</p>
            <span className="go">{home.recording.cta} <ArrowIcon width={16} /></span>
            <input
              className="sr-only"
              type="file"
              accept="video/*"
              aria-label={home.recording.inputLabel}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onStart("file", f);
                e.target.value = "";
              }}
            />
          </label>
          <StartCard icon={<CameraIcon />} title={home.camera.title} text={home.camera.body} cta={home.camera.cta} onClick={() => onStart("camera")} testId="start-camera" />
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <h2>{home.howToCheck}</h2>
          <div className="grid3">
            {home.steps.map((step) => <Step key={step.number} n={step.number} title={step.title}>{step.body}</Step>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid2">
          <div>
            <h2>{home.whatItLooksFor}</h2>
            <div className="tells">
              {home.tells.map((tell, i) => <Tell key={tell.title} icon={icons[i]} title={tell.title}>{tell.body}</Tell>)}
            </div>
          </div>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div className="card">
              <h3><LockIcon width={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />{home.privacyTitle}</h3>
              <p>{home.privacyBody}</p>
            </div>
            <div className="note">
              <b>{home.safetyTitle}</b> {home.safetyBody}
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
