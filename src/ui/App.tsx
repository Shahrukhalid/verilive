import { useCallback, useEffect, useRef, useState } from "react";
import { Scanner } from "../vision/scanner";
import { Home } from "./Home";
import { GithubIcon, Logo, SunMoonIcon } from "./icons";
import type { Translate } from "../i18n";
import { I18nProvider, useI18n } from "../i18n/react";
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

const VOICE_KEY = "verilive-voice";

function readVoice(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) === "on";
  } catch {
    return false;
  }
}

export function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}

function AppShell() {
  const { t } = useI18n();
  const [scanner, setScanner] = useState<Scanner | null>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const initRef = useRef<Promise<Scanner> | null>(null);
  const startingRef = useRef(false);
  const [view, setView] = useState<{ kind: SourceKind; file?: File; stream?: MediaStream; key: number } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme);
  // Experimental, off by default. Remembered in this browser only.
  const [voice, setVoice] = useState<boolean>(readVoice);
  const voiceRef = useRef(voice);
  const changeVoice = useCallback((on: boolean) => {
    voiceRef.current = on;
    setVoice(on);
    try {
      localStorage.setItem(VOICE_KEY, on ? "on" : "off");
    } catch {
      /* storage can be unavailable; the setting still applies for this visit */
    }
  }, []);

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
    if (startingRef.current) return; // a second click while the first start is still running
    startingRef.current = true;
    setError(null);
    let stream: MediaStream | undefined;
    try {
      // Ask for the screen or camera first, while the click still counts as a user gesture.
      if (kind === "screen") stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: voiceRef.current });
      if (kind === "camera") stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) {
      setError(sourceError(kind, e, t));
      startingRef.current = false;
      return;
    }
    try {
      if (!scannerRef.current) {
        setLoading(t("app.loadingModel"));
        // One shared load, however many times people click.
        initRef.current ??= (async () => {
          const s = new Scanner();
          try {
            await s.init(4);
          } catch (e) {
            s.close();
            initRef.current = null;
            throw e;
          }
          return s;
        })();
        const s = await initRef.current;
        scannerRef.current = s;
        setScanner(s);
      }
      setView({ kind, file, stream, key: Date.now() });
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      setError(t("app.modelError", { message: (e as Error).message }));
    } finally {
      setLoading(null);
      startingRef.current = false;
    }
  }, [t]);

  const exit = useCallback((message?: string) => {
    setView(null);
    if (message) setError(message);
  }, []);

  const nextTheme: Record<Theme, Theme> = { system: "dark", dark: "light", light: "system" };
  const themeName = t(`theme.${theme}`);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wrap">
          <button className="brand" onClick={() => setView(null)} aria-label={t("app.homeLabel")}>
            <Logo />
            <span className="brand-name">Verilive</span>
            <span className="brand-tag">{t("app.brandTag")}</span>
          </button>
          <span className="spacer" />
          <button className="iconbtn" onClick={() => setTheme(nextTheme[theme])} aria-label={t("app.themeSwitch", { theme: themeName })} title={t("app.themeTitle", { theme: themeName })}>
            <SunMoonIcon /> <span className="hide-sm">{themeName}</span>
          </button>
          <a className="iconbtn" href={REPO} target="_blank" rel="noopener noreferrer">
            <GithubIcon /> <span className="hide-sm">{t("app.star")}</span>
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
        <Session key={view.key} kind={view.kind} file={view.file} stream={view.stream} scanner={scanner} onExit={exit} voiceEnabled={voice} onVoiceChange={changeVoice} />
      ) : (
        <Home onStart={start} error={error} busy={!!loading} voice={voice} onVoiceChange={changeVoice} />
      )}

      <footer className="footer">
        <div className="wrap">
          <span>{t("footer.summary", { version: APP_VERSION })}</span>
          <span>
            <a href={`${REPO}#how-it-works`} target="_blank" rel="noopener noreferrer">{t("footer.how")}</a> ·{" "}
            <a href={`${REPO}/blob/main/docs/LIMITATIONS.md`} target="_blank" rel="noopener noreferrer">{t("footer.limits")}</a> ·{" "}
            <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">{t("footer.report")}</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

function sourceError(kind: SourceKind, e: unknown, t: Translate): string {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError" || name === "AbortError") return kind === "camera" ? t("error.cameraBlocked") : t("error.screenCancelled");
  if (name === "NotFoundError") return t("error.noCamera");
  if (name === "NotReadableError") return t("error.cameraBusy");
  return t("error.startFailed", { message: (e as Error)?.message ?? String(e) });
}
