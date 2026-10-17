import type { Dictionary, Params, Translate, TranslationKey } from "./types";

/** Replaces {name} placeholders. A placeholder with no matching parameter is left as written. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/**
 * Builds a translate function for one language.
 * Lookup order: the language, then the fallback, then the key itself, so a missing
 * translation never crashes or shows a blank. A numeric `count` parameter selects the
 * plural form ("key.one", "key.other", ...) using the language's own plural rules.
 */
export function createTranslator(locale: string, dictionary: Partial<Dictionary>, fallback: Dictionary): Translate {
  const rules = new Intl.PluralRules(locale);
  const lookup = (key: string): string | undefined => (dictionary as Record<string, string | undefined>)[key] ?? (fallback as Record<string, string | undefined>)[key];
  return (key: TranslationKey, params?: Params) => {
    let template: string | undefined;
    if (typeof params?.count === "number") template = lookup(`${key}.${rules.select(params.count)}`) ?? lookup(`${key}.other`);
    template ??= lookup(key);
    return interpolate(template ?? key, params);
  };
}
