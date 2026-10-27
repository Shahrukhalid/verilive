/** Picks a supported language from the browser's preferred ones. Knows nothing about dictionaries. */

/** Old or alternative codes mapped to the code we use. */
const ALIASES: Record<string, string> = { tl: "fil", in: "id" };

/** "es-MX" -> "es", "pt_BR" -> "pt", "TL" -> "fil". Returns "" for anything unusable. */
export function primaryLanguage(tag: string): string {
  const primary = tag.trim().toLowerCase().replace(/_/g, "-").split("-")[0] ?? "";
  return ALIASES[primary] ?? primary;
}

/**
 * Returns the first preferred language we support, else the fallback.
 * Pass `navigator.language`, or `navigator.languages` to honour the whole preference order.
 */
export function detectLocale<L extends string>(preferred: string | readonly string[] | null | undefined, supported: readonly L[], fallback: L): L {
  const list = typeof preferred === "string" ? [preferred] : (preferred ?? []);
  for (const tag of list) {
    const code = primaryLanguage(tag);
    const match = supported.find((l) => l === code);
    if (match) return match;
  }
  return fallback;
}
