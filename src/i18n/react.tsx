import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { browserLocale, translatorFor, type Locale, type Translate } from "./index";

interface I18n {
  locale: Locale;
  t: Translate;
}

const I18nContext = createContext<I18n>({ locale: "en", t: translatorFor("en") });

/** Provides the translate function to the tree. Defaults to the browser's language. */
export function I18nProvider({ locale, children }: { locale?: Locale; children: ReactNode }) {
  const active = useMemo(() => locale ?? browserLocale(), [locale]);
  const value = useMemo<I18n>(() => ({ locale: active, t: translatorFor(active) }), [active]);
  useEffect(() => {
    document.documentElement.lang = active;
  }, [active]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
