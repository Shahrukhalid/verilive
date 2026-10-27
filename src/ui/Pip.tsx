import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/react";
import type { Assessment } from "../engine/types";
import { LEVEL_COLOR } from "./PersonCard";

/** The slice of the Document Picture-in-Picture API this app uses (not yet in the TypeScript DOM types). */
interface DocumentPip {
  requestWindow(options?: { width?: number; height?: number; disallowReturnToOpener?: boolean }): Promise<Window>;
}

function api(): DocumentPip | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
}

/** True where the Document Picture-in-Picture API exists (Chromium 116+). The button is hidden elsewhere. */
export function pipSupported(): boolean {
  return !!api();
}

export interface PipPerson {
  id: number;
  assessment: Assessment;
  onScreen: boolean;
}

/**
 * Opens and closes the floating window. It is a same-origin document that stays in this tab's
 * process, so nothing is fetched and the page's own Content Security Policy applies to it.
 */
export function usePip() {
  const [win, setWin] = useState<Window | null>(null);
  const current = useRef<Window | null>(null);

  const close = useCallback(() => {
    const w = current.current;
    current.current = null;
    setWin(null);
    if (w && !w.closed) w.close();
  }, []);

  const open = useCallback(async () => {
    const pip = api();
    if (!pip || current.current) return;
    try {
      const w = await pip.requestWindow({ width: 300, height: 220 });
      copyTheme(w);
      w.addEventListener("pagehide", () => {
        if (current.current === w) {
          current.current = null;
          setWin(null);
        }
      });
      current.current = w;
      setWin(w);
    } catch {
      // The browser refused (no user gesture, or the user dismissed it). Leave the button as it was.
    }
  }, []);

  // Never leave an orphaned window behind when the session screen goes away.
  useEffect(() => close, [close]);

  return { win, open, close };
}

/** Gives the floating window the same stylesheets (own origin only), theme and language as the page. */
function copyTheme(w: Window): void {
  const src = document.documentElement;
  const dst = w.document.documentElement;
  dst.lang = src.lang;
  const theme = src.getAttribute("data-theme");
  if (theme) dst.setAttribute("data-theme", theme);
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    const copy = w.document.createElement("link");
    copy.rel = "stylesheet";
    copy.href = link.href;
    w.document.head.appendChild(copy);
  }
  w.document.body.className = "pip-body";
}

function setTitle(w: Window, title: string): void {
  w.document.title = title;
}

/** Renders the compact verdict list into the floating window (a React portal, so it updates live). */
export function PipView({ win, people, onClose }: { win: Window; people: PipPerson[]; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    setTitle(win, t("pip.title"));
  }, [win, t]);
  return createPortal(
    <div className="pip" data-testid="pip-view">
      <ul className="pip-list" aria-live="polite">
        {people.map((p) => {
          const { level, score } = p.assessment;
          const title = t(`level.${level}.title`);
          return (
            <li key={p.id} className="pip-row" data-level={level}>
              <i className="pip-dot" style={{ background: LEVEL_COLOR[level] }} aria-hidden="true" />
              <span className="pip-name">{t("person.title", { id: p.id })}</span>
              <b className={`level lv-${level}`}>{title}</b>
              <span className="pip-risk">{level === "collecting" ? "…" : t("person.risk", { percent: Math.round(score * 100) })}</span>
            </li>
          );
        })}
      </ul>
      {people.length === 0 && <p className="muted pip-empty">{t("pip.empty")}</p>}
      <p className="muted pip-note">{t("pip.note")}</p>
      <button className="btn pip-close" onClick={onClose}>
        {t("pip.close")}
      </button>
    </div>,
    win.document.body,
  );
}
