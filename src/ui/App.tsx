import { useCallback, useEffect, useRef, useState } from "react";
import { Scanner } from "../vision/scanner";
import { Home } from "./Home";
import { GithubIcon, Logo, SunMoonIcon } from "./icons";
import { APP_VERSION, type SourceKind } from "./report";
import { Session } from "./Session";

type Theme = "system" | "light" | "dark";
const REPO = "https://github.com/Shahrukhalid/verilive";

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("verilive-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function App() {
  const [scanner, setScanner] = useState<Scanner | null>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const [view, setView] = useState<{ kind: SourceKind; file?: File; stream?: MediaStream; key: number } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("verilive-theme", theme);
    } catch {
      /* storage can be unavailable (private mode); the theme still applies */
    }
  }, [theme]);

  useEffect(() => () => scannerRef.current?.close(), []);

  // The app owns the shared screen or camera; stop it when the session ends.
  useEffect(() => () => view?.stream?.getTracks().forEach((t) => t.stop()), [view]);

  const start = useCallback(async (kind: SourceKind, file?: File) => {
    setError(null);
    let stream: MediaStream | undefined;
    try {
      // Ask for the screen or camera first, while the click still counts as a user gesture.
      if (kind === "screen") stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false });
      if (kind === "camera") stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      setError(sourceError(kind, e));
      return;
    }
    try {
      if (!scannerRef.current) {
        setLoading("Loading the face model. The first visit takes a few seconds; after that it is cached.");
        const s = new Scanner();
        await s.init(4);
        scannerRef.current = s;
        setScanner(s);
      }
      setView({ kind, file, stream, key: Date.now() });
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      setError(`The face model could not load in this browser: ${(e as Error).message}. Try a recent Chrome, Edge or Firefox.`);
    } finally {
      setLoading(null);
    }
  }, []);

  const exit = useCallback((message?: string) => {
    setView(null);
    if (message) setError(message);
  }, []);

  const nextTheme: Record<Theme, Theme> = { system: "dark", dark: "light", light: "system" };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wrap">
          <button className="brand" onClick={() => setView(null)} aria-label="Verilive home">
            <Logo />
            <span className="brand-name">Verilive</span>
            <span className="brand-tag">deepfake check</span>
          </button>
          <span className="spacer" />
          <button className="iconbtn" onClick={() => setTheme(nextTheme[theme])} aria-label={`Theme: ${theme}. Switch theme`} title={`Theme: ${theme}`}>
            <SunMoonIcon /> <span className="hide-sm">{theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <a className="iconbtn" href={REPO} target="_blank" rel="noopener noreferrer">
            <GithubIcon /> <span className="hide-sm">Star on GitHub</span>
          </a>
        </div>
      </header>

      {loading && (
        <div className="wrap" style={{ paddingTop: 16 }}>
          <div className="card" role="status" data-testid="loading">
            <span className="loading"><span className="spinner" /> {loading}</span>
          </div>
        </div>
      )}

      {view && scanner ? (
        <Session key={view.key} kind={view.kind} file={view.file} stream={view.stream} scanner={scanner} onExit={exit} />
      ) : (
        <Home onStart={start} error={error} />
      )}

      <footer className="footer">
        <div className="wrap">
          <span>Verilive {APP_VERSION} · MIT licensed · Risk signals, not proof.</span>
          <span>
            <a href={`${REPO}#how-it-works`} target="_blank" rel="noopener noreferrer">How it works</a> ·{" "}
            <a href={`${REPO}/blob/main/docs/LIMITATIONS.md`} target="_blank" rel="noopener noreferrer">Limitations</a> ·{" "}
            <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">Report a problem</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

function sourceError(kind: SourceKind, e: unknown): string {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError" || name === "AbortError") {
    return kind === "camera"
      ? "Camera access was blocked. Allow it from the browser's address bar and try again."
      : "Screen sharing was cancelled. Click \"Check a live call\" again and pick the call window.";
  }
  if (name === "NotFoundError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is busy in another app. Close it there and try again.";
  return `Could not start: ${(e as Error)?.message ?? String(e)}`;
}
