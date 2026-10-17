import { detectLocale } from "./detect";
import { DEFAULT_LOCALE, DICTIONARIES, SUPPORTED_LOCALES, type Locale } from "./locales";
import { createTranslator } from "./translate";
import type { Params, Translate, TranslationKey } from "./types";

export { detectLocale } from "./detect";
export { DEFAULT_LOCALE, DICTIONARIES, SUPPORTED_LOCALES, type Locale } from "./locales";
export { createTranslator, interpolate } from "./translate";
export type { Dictionary, MessageKey, Params, Translate, TranslationKey } from "./types";

/** A translator for one of the supported languages, with English as the fallback. */
export function translatorFor(locale: Locale): Translate {
  return createTranslator(locale, DICTIONARIES[locale], DICTIONARIES[DEFAULT_LOCALE]);
}

/** English translator, used for the saved JSON report and for the engine's own `detail` text. */
export const tEn: Translate = translatorFor(DEFAULT_LOCALE);

/** The supported language that best matches the browser (`navigator.languages`, then `navigator.language`). */
export function browserLocale(nav: Pick<Navigator, "language" | "languages"> | undefined = typeof navigator === "undefined" ? undefined : navigator): Locale {
  const preferred = nav?.languages?.length ? nav.languages : nav?.language;
  return detectLocale(preferred, SUPPORTED_LOCALES, DEFAULT_LOCALE);
}

/**
 * What a detector returns for its detail sentence: the English text (for reports and tests)
 * plus the key and parameters, so the interface can show it in the reader's language.
 */
export function describe(detailKey: TranslationKey, detailParams?: Params): { detail: string; detailKey: TranslationKey; detailParams?: Params } {
  return { detail: tEn(detailKey, detailParams), detailKey, detailParams };
}
