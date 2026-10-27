import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceMonitor, type VoiceView } from "../audio/voiceMonitor";
import type { Box, TimelinePoint } from "../engine/analyzer";
import type { Assessment, Sensitivity } from "../engine/types";
import { useI18n } from "../i18n/react";
import type { ScannedFace, Scanner } from "../vision/scanner";
import { LEVEL_COLOR, PersonCard } from "./PersonCard";
import { PipView, pipSupported, usePip } from "./Pip";
import { VoiceCard } from "./VoiceCard";
import { buildReport, summaryText, type SourceKind } from "./report";
import { CopyIcon, DownloadIcon, PauseIcon, PlayIcon, SettingsIcon, PipIcon, StopIcon, TurnIcon } from "./icons";

type Status = "starting" | "running" | "paused" | "ended" | "error";
interface Person {
  id: number;
  assessment: Assessment;
  timeline: TimelinePoint[];
  wave: number[];
  onScreen: boolean;
}

const FRAME_INTERVAL_MS = 45; // up to ~20 analyses per second, limited by the video's frame rate
const CHECK_SECONDS = 12;

export function Session({ kind, file, stream, scanner, onExit, voiceEnabled, onVoiceChange }: { kind: SourceKind; file?: File; stream?: MediaStream; scanner: Scanner; onExit: (error?: string) => void; voiceEnabled: boolean; onVoiceChange: (on: boolean) => void }) {
  const { t } = useI18n();
  const pip = usePip();
  const canPip = pipSupported();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef<ScannedFace[]>([]);
  const paused = useRef(false);
  const startedAt = useRef(new Date());
  // Active analysis time: excludes time spent paused and stops counting once the session ends.
  const clock = useRef({ activeMs: 0, since: null as number | null });
  const stopClock = () => {
    const c = clock.current;
    if (c.since !== null) c.activeMs += performance.now() - c.since;
    c.since = null;
  };
  const [status, setStatus] = useState<Status>("starting");
  const [label, setLabel] = useState(kind === "file" ? file?.name ?? t("session.source.file") : kind === "camera" ? t("session.source.camera") : t("session.source.screen"));
  const [people, setPeople] = useState<Person[]>([]);
  const [facesNow, setFacesNow] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [sensitivity, setSensitivity] = useState<Sensitivity>(scanner.sensitivity);
  const [overlay, setOverlay] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [checkLeft, setCheckLeft] = useState<number | null>(null);
  const [checkDone, setCheckDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ region: Box | null; auto: boolean }>({ region: null, auto: false });
  const zoomRef = useRef(zoom);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const voiceMonitor = useRef<VoiceMonitor | null>(null);
  const [voiceView, setVoiceView] = useState<VoiceView | null>(null);
  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  // Start the source and the analysis loop.
  useEffect(() => {
    const video = videoRef.current!;
    let url: string | null = null;
    let stopped = false;
    let last = 0;
    let handle = 0;
    let usesVideoFrames = false;
    let track: MediaStreamTrack | undefined;
    const onTrackEnded = () => {
      stopClock();
      setStatus("ended");
    };
    scanner.reset();

    const faceLabel = (f: ScannedFace) => t("session.overlayLabel", { id: f.id, title: t(`level.${f.assessment.level}.title`) });
    const draw = () => drawOverlay(canvasRef.current, video, overlayRef.current ? latest.current : [], zoomRef.current.region, faceLabel);
    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      if (!paused.current && now - last >= FRAME_INTERVAL_MS && !video.paused && !video.ended) {
        last = now;
        const r = scanner.scan(video, now);
        if (r) {
          latest.current = r.faces;
          if (r.region !== zoomRef.current.region) {
            zoomRef.current = { region: r.region, auto: r.autoZoom };
            setZoom(zoomRef.current);
          }
          draw();
        }
      }
      schedule();
    };
    const schedule = () => {
      if (stopped) return;
      usesVideoFrames = "requestVideoFrameCallback" in video;
      if (usesVideoFrames) handle = video.requestVideoFrameCallback(() => tick());
      else handle = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (kind === "file" && file) {
          url = URL.createObjectURL(file);
          video.src = url;
        } else if (stream) {
          track = stream.getVideoTracks()[0];
          if (track) {
            if (kind === "screen" && track.label) setLabel(track.label);
            track.addEventListener("ended", onTrackEnded);
          }
          video.srcObject = stream;
        }
        video.muted = true;
        video.playsInline = true;
        await video.play();
        if (stopped) return;
        startedAt.current = new Date();
        clock.current = { activeMs: 0, since: performance.now() };
        setStatus("running");
        schedule();
      } catch (e) {
        if (stopped) return;
        const err = e as DOMException;
        const message =
          kind === "file" ? t("session.error.file") : t("session.error.video", { message: err?.message ?? String(e) });
        onExit(message);
      }
    })();

    const onEnded = () => {
      stopClock();
      setStatus("ended");
    };
    video.addEventListener("ended", onEnded);
    return () => {
      stopped = true;
      if (usesVideoFrames) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      track?.removeEventListener("ended", onTrackEnded);
      video.removeEventListener("ended", onEnded);
      if (url) URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.srcObject = null;
    };
  }, [kind, file, stream, scanner, onExit, t]);

  // Refresh the side panel a few times per second (cheaper than on every frame).
  useEffect(() => {
    const id = window.setInterval(() => {
      const c = clock.current;
      const t = (c.activeMs + (c.since !== null ? performance.now() - c.since : 0)) / 1000;
      const onScreen = new Set(latest.current.map((f) => f.id));
      setFacesNow(latest.current.length);
      setPeople(
        scanner.tracker
          .all()
          .filter((p) => p.analyzer.latest)
          .map((p) => ({ id: p.id, assessment: p.analyzer.latest!, timeline: [...p.analyzer.timeline], wave: p.analyzer.wave, onScreen: onScreen.has(p.id) })),
      );
      setElapsed(t);
      setHidden(document.hidden);
      const monitor = voiceMonitor.current;
      if (monitor) {
        monitor.paused = paused.current;
        setVoiceView(monitor.view());
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [scanner]);

  useEffect(() => {
    scanner.setSensitivity(sensitivity);
  }, [scanner, sensitivity]);

  useEffect(() => {
    if (!overlay) drawOverlay(canvasRef.current, videoRef.current, [], zoomRef.current.region, () => "");
  }, [overlay]);

  const setRegion = (region: Box | null) => {
    scanner.setRegion(region);
    zoomRef.current = { region, auto: false };
    setZoom(zoomRef.current);
  };

  // Drag a box on the video to analyze just that person (helps with small faces in gallery view).
  const toVideo = (e: React.PointerEvent<HTMLCanvasElement>) => videoPoint(e.currentTarget, videoRef.current, e.clientX, e.clientY);
  const local = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toVideo(e);
    if (!p) return;
    drag.current = { ...p, ...local(e) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = drag.current;
    if (!start) return;
    const { px, py } = local(e);
    setDragRect({ left: Math.min(start.px, px), top: Math.min(start.py, py), width: Math.abs(px - start.px), height: Math.abs(py - start.py) });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = drag.current;
    const p = toVideo(e);
    drag.current = null;
    setDragRect(null);
    if (!start || !p) return;
    const b = boxFrom(start, p);
    if (b.w > 0.06 && b.h > 0.06) {
      setRegion(b);
      flash(t("session.toast.region"));
    }
  };

  // Guided head-turn check: record for CHECK_SECONDS while the person turns their head.
  const checkTimer = useRef<number | null>(null);
  const startCheck = () => {
    scanner.setCheckActive(true);
    setCheckDone(false);
    setCheckLeft(CHECK_SECONDS);
    let left = CHECK_SECONDS;
    checkTimer.current = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        if (checkTimer.current) window.clearInterval(checkTimer.current);
        checkTimer.current = null;
        scanner.setCheckActive(false);
        setCheckLeft(null);
        setCheckDone(true);
      } else setCheckLeft(left);
    }, 1000);
  };
  useEffect(
    () => () => {
      if (checkTimer.current) window.clearInterval(checkTimer.current);
      scanner.setCheckActive(false);
    },
    [scanner],
  );

  const playAttempt = useRef(0);
  const togglePause = () => {
    paused.current = !paused.current;
    if (paused.current) stopClock();
    else clock.current.since = performance.now();
    const v = videoRef.current;
    const attempt = ++playAttempt.current;
    if (kind === "file" && v) {
      if (paused.current) v.pause();
      // play() can reject (e.g. the browser blocks playback); go back to paused instead of an unhandled rejection.
      else
        v.play().catch(() => {
          // Ignore rejections from superseded attempts (a later pause/resume owns the state now).
          if (attempt !== playAttempt.current) return;
          paused.current = true;
          stopClock();
          setStatus("paused");
        });
    }
    setStatus(paused.current ? "paused" : "running");
  };

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2400);
  };

  const report = useCallback(
    () => buildReport({ kind, label, startedAt: startedAt.current, seconds: elapsed, sensitivity, voice: voiceEnabled ? voiceView?.snapshot : null }, scanner.tracker),
    [kind, label, elapsed, sensitivity, scanner, voiceEnabled, voiceView],
  );

  const download = () => {
    const blob = new Blob([JSON.stringify(report(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `verilive-report-${startedAt.current.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash(t("session.toast.saved"));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(report(), t));
      flash(t("session.toast.copied"));
    } catch {
      flash(t("session.toast.copyBlocked"));
    }
  };

  const ended = status === "ended";

  // Experimental voice signal: only when the setting is on and a shared screen carries an audio track.
  // Leaving the setting, ending the share or closing the session stops and disconnects the listener.
  useEffect(() => {
    if (!voiceEnabled || ended || kind !== "screen" || !stream) return;
    const monitor = new VoiceMonitor(stream);
    voiceMonitor.current = monitor;
    void monitor.start();
    return () => {
      monitor.stop();
      voiceMonitor.current = null;
      setVoiceView(monitor.view());
    };
  }, [voiceEnabled, ended, kind, stream]);
  const worst = people.reduce<Person | null>((w, p) => (!w || rank(p.assessment.level) > rank(w.assessment.level) ? p : w), null);

  return (
    <main className="wrap session" data-testid="session">
      {pip.win && <PipView win={pip.win} people={people} onClose={pip.close} />}
      <div style={{ minWidth: 0 }}>
        <div className="toolbar">
          <span className={`live${status === "running" ? "" : " paused"}`} data-testid="status">
            <i />
            {t(status === "starting" ? "session.status.starting" : status === "running" ? "session.status.running" : status === "paused" ? "session.status.paused" : "session.status.ended")} · {fmtTime(elapsed)}
          </span>
          <span className="muted" style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }} title={label}>
            {label}
          </span>
          <span className="spacer" />
          {!ended && (
            <button className="btn" onClick={togglePause} disabled={status === "starting"}>
              {status === "paused" ? <PlayIcon /> : <PauseIcon />}
              <span className="hide-sm">{status === "paused" ? t("session.resume") : t("session.pause")}</span>
            </button>
          )}
          {canPip && (
            <button className="btn" onClick={() => void (pip.win ? pip.close() : pip.open())} aria-pressed={!!pip.win} title={t("pip.note")} data-testid="pip-toggle">
              <PipIcon />
              <span className="hide-sm">{t(pip.win ? "pip.close" : "pip.open")}</span>
            </button>
          )}
          <div className="rel">
            <button className="btn" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings} aria-label={t("session.settings")}>
              <SettingsIcon />
            </button>
            {showSettings && (
              <div className="card popover">
                <div className="field">
                  <label id="sens-label">{t("session.sensitivity")}</label>
                  <div className="seg" role="group" aria-labelledby="sens-label">
                    {(["relaxed", "balanced", "strict"] as const).map((s) => (
                      <button key={s} aria-pressed={sensitivity === s} onClick={() => setSensitivity(s)}>
                        {t(`session.sensitivity.${s}`)}
                      </button>
                    ))}
                  </div>
                  <span className="muted" style={{ fontSize: 13 }}>{t("session.sensitivityHint")}</span>
                </div>
                <label className="field" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> {t("session.showBoxes")}
                </label>
                <div className="field">
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={voiceEnabled} onChange={(e) => onVoiceChange(e.target.checked)} data-testid="voice-toggle-session" /> {t("voice.setting.label")}
                  </label>
                  <span className="muted" style={{ fontSize: 13 }}>{t("voice.setting.hint")}</span>
                </div>
              </div>
            )}
          </div>
          <button className="btn btn-danger" onClick={() => onExit()}>
            <StopIcon /> <span className="hide-sm">{t("session.end")}</span>
          </button>
        </div>

        <div className="stage">
          <video ref={videoRef} aria-label={t("session.videoAria")} />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{ cursor: "crosshair", touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
          {dragRect && <div className="dragrect" style={dragRect} />}
          {status !== "starting" && facesNow === 0 && !ended && (
            <div className="empty" data-testid="no-face">
              <div>
                <b>{t("session.noFace.title")}</b>
                <span>{t("session.noFace.text")}</span>
              </div>
            </div>
          )}
          {status === "starting" && (
            <div className="empty">
              <span className="loading"><span className="spinner" /> {t("session.startingVideo")}</span>
            </div>
          )}
        </div>
        <div className="under">
          {zoom.region ? (
            <span data-testid="zoom">
              {zoom.auto ? t("session.zoom.auto") : t("session.zoom.manual")}{" "}
              <button className="linkbtn" onClick={() => setRegion(null)}>{t("session.zoom.reset")}</button>
            </span>
          ) : (
            <span>{t("session.zoom.tip")}</span>
          )}
          <span>{t("session.faces", { count: facesNow })}</span>
          <span>{t("session.local")}</span>
          {hidden && <span style={{ color: "var(--warn)" }}>{t("session.hidden")}</span>}
        </div>
        {ended && (
          <div className="card" style={{ marginTop: 14 }} role="status">
            <h3>{kind === "file" ? t("session.ended.file") : t("session.ended.share")}</h3>
            <p className="muted" style={{ marginTop: 4 }}>{t("session.ended.text")}</p>
          </div>
        )}
      </div>

      <aside className="side" aria-label={t("session.results")}>
        <div aria-live="polite" className="sr-only">
          {worst && worst.assessment.level !== "collecting" ? t("session.announce", { id: worst.id, title: t(`level.${worst.assessment.level}.title`) }) : ""}
        </div>
        {people.length === 0 && (
          <div className="card">
            <div className="panel-title">{t("session.results")}</div>
            <p className="muted">{t("session.results.empty")}</p>
          </div>
        )}
        {people.map((p) => (
          <PersonCard key={p.id} {...p} />
        ))}

        {voiceEnabled && <VoiceCard available={kind === "screen"} view={voiceView} />}

        <div className="card check">
          <div className="panel-title">{t("check.title")}</div>
          {checkLeft === null ? (
            <>
              <ol>
                <li>{t("check.step1")}</li>
                <li>{t("check.step2")}</li>
              </ol>
              <button className="btn btn-primary" onClick={startCheck} disabled={ended || status !== "running"} data-testid="start-check">
                <TurnIcon /> {t("check.start", { seconds: CHECK_SECONDS })}
              </button>
              {checkDone && <p className="muted" style={{ fontSize: 14 }}>{t("check.done")}</p>}
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="count" aria-live="polite">{checkLeft}</span>
              <span className="muted">{t("check.recording")}</span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="panel-title">{t("verify.title")}</div>
          <ul className="tips">
            <li>{t("verify.tip1")}</li>
            <li>{t("verify.tip2")}</li>
            <li>{t("verify.tip3")}</li>
            <li>{t("verify.tip4")}</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={download} disabled={!people.length}><DownloadIcon /> {t("session.save")}</button>
          <button className="btn" onClick={copy} disabled={!people.length}><CopyIcon /> {t("session.copy")}</button>
        </div>
      </aside>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function rank(level: Assessment["level"]): number {
  return { collecting: 0, low: 1, elevated: 2, high: 3 }[level];
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Draws a box and a label for each face, matching the letterboxed video position. */
function drawOverlay(canvas: HTMLCanvasElement | null, video: HTMLVideoElement | null, faces: ScannedFace[], region: Box | null, labelOf: (face: ScannedFace) => string): void {
  if (!canvas || !video) return;
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.min(cw / vw, ch / vh);
  const ox = (cw - vw * scale) / 2;
  const oy = (ch - vh * scale) / 2;
  const css = getComputedStyle(document.documentElement);
  if (region) {
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.strokeRect(ox + region.x * vw * scale, oy + region.y * vh * scale, region.w * vw * scale, region.h * vh * scale);
    ctx.restore();
  }
  for (const f of faces) {
    const color = css.getPropertyValue(LEVEL_COLOR[f.assessment.level].slice(4, -1)).trim() || "#7c9cff";
    const x = ox + f.box.x * vw * scale;
    const y = oy + f.box.y * vh * scale;
    const w = f.box.w * vw * scale;
    const h = f.box.h * vh * scale;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.stroke();
    ctx.fillStyle = color;
    for (const p of f.points) {
      ctx.beginPath();
      ctx.arc(ox + p.x * vw * scale, oy + p.y * vh * scale, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    const text = labelOf(f);
    ctx.font = "600 13px Onest Variable, system-ui, sans-serif";
    const tw = ctx.measureText(text).width + 16;
    const ty = Math.max(0, y - 26);
    ctx.beginPath();
    ctx.roundRect(x, ty, tw, 22, 6);
    ctx.fill();
    ctx.fillStyle = "#0b1220";
    ctx.fillText(text, x + 8, ty + 15);
  }
}

/** Converts a pointer position on the stage to normalized video coordinates (accounts for letterboxing). */
function videoPoint(canvas: HTMLCanvasElement, video: HTMLVideoElement | null, clientX: number, clientY: number): { x: number; y: number } | null {
  if (!video?.videoWidth) return null;
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
  const ox = (rect.width - video.videoWidth * scale) / 2;
  const oy = (rect.height - video.videoHeight * scale) / 2;
  const x = (clientX - rect.left - ox) / (video.videoWidth * scale);
  const y = (clientY - rect.top - oy) / (video.videoHeight * scale);
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

function boxFrom(a: { x: number; y: number }, b: { x: number; y: number }): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}
