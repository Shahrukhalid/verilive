import type { en } from "./locales/en";

/** Every message key. English is the source of truth, so the other languages must match it. */
export type MessageKey = keyof typeof en;

/** The key without its plural suffix: "x.one" and "x.other" are both reachable as "x". */
type PluralBase<K extends string> = K extends `${infer Base}.${"one" | "other"}` ? Base : never;

/** What callers may pass to the translator: a full key, or the base of a plural pair. */
export type TranslationKey = MessageKey | PluralBase<MessageKey>;

export type Dictionary = Record<MessageKey, string>;
export type Params = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: Params) => string;
