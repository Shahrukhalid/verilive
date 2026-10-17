import type { ReactNode } from "react";
import type { SourceKind } from "./report";
import { ArrowIcon, CameraIcon, CheckIcon, EyeIcon, FileIcon, HeartIcon, LayersIcon, LockIcon, ScreenIcon, TurnIcon, WaveIcon } from "./icons";

const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

export function Home({ onStart, error }: { onStart: (kind: SourceKind, file?: File) => void; error: string | null }) {
  return (
    <main>
      <div className="wrap">
        <section className="hero">
          <span className="eyebrow">Open-source deepfake check</span>
          <h1>
            Is the face on your call <em>really there?</em>
          </h1>
          <p className="lead">
            Verilive watches a Zoom, Google Meet or Teams call and looks for the tells of a face swap: no pulse in the skin,
            unnatural blinking, and a face that breaks apart when the head turns. Everything runs in this browser tab.
          </p>
          <div className="trust">
            <span><CheckIcon /> Video never leaves your computer</span>
            <span><CheckIcon /> No account, no install</span>
            <span><CheckIcon /> Free and open source (MIT)</span>
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
            title="Check a live call"
            text={canShare ? "Share the call window. Verilive analyzes the people you can see." : "Needs a desktop browser such as Chrome, Edge or Firefox."}
            cta="Choose call window"
            disabled={!canShare}
            onClick={() => onStart("screen")}
            testId="start-screen"
          />
          <label className="start" data-testid="start-file">
            <span className="ico"><FileIcon /></span>
            <h2>Analyze a recording</h2>
            <p>Open a video file of a call or a clip someone sent you. It stays on this device.</p>
            <span className="go">Choose video file <ArrowIcon width={16} /></span>
            <input
              className="sr-only"
              type="file"
              accept="video/*"
              aria-label="Choose a video file to analyze"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onStart("file", f);
                e.target.value = "";
              }}
            />
          </label>
          <StartCard icon={<CameraIcon />} title="Try it on yourself" text="See how a real face scores using your own camera. Nothing is recorded." cta="Use my camera" onClick={() => onStart("camera")} testId="start-camera" />
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <h2>How to check a call</h2>
          <div className="grid3">
            <Step n="01" title="Start the call as usual">Use the Zoom, Teams or Webex app, or Meet in your browser. Spotlight or pin the person you want to check.</Step>
            <Step n="02" title="Share the call window here">Click "Check a live call" and pick the call window. Verilive only reads the picture; it cannot see anything else.</Step>
            <Step n="03" title="Watch the verdict">After about 15 seconds each person gets a reading. For a stronger test, ask them to turn their head slowly to each side.</Step>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid2">
          <div>
            <h2>What it looks for</h2>
            <div className="tells">
              <Tell icon={<HeartIcon />} title="A heartbeat in the skin">Real skin changes colour very slightly with every heartbeat. Replayed and generated faces rarely do.</Tell>
              <Tell icon={<EyeIcon />} title="Natural blinking">People blink irregularly, with both eyes, several times a minute.</Tell>
              <Tell icon={<LayersIcon />} title="A pasted-on face">Swapped faces are often softer than the skin around them and flicker in colour.</Tell>
              <Tell icon={<WaveIcon />} title="Shape stability">The geometry of a real face moves smoothly. Swaps tend to shimmer.</Tell>
              <Tell icon={<TurnIcon />} title="The head-turn test">Face swaps are built from front-facing photos and break down when the head turns.</Tell>
            </div>
          </div>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <div className="card">
              <h3><LockIcon width={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />Private by design</h3>
              <p>The face model and all analysis run inside this page. No video, images or audio are uploaded, and the page has no server to send them to.</p>
            </div>
            <div className="note">
              <b>Signals, not proof.</b> Bad lighting, heavy compression or beauty filters can make a real person look suspicious, and new
              deepfakes may pass. If a call asks for money, passwords or urgent action, verify the person another way, whatever the score says.
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
