import type { Dictionary } from "../types";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fil } from "./fil";
import { fr } from "./fr";
import { id } from "./id";
import { ja } from "./ja";
import { pt } from "./pt";
import { zh } from "./zh";

/** Every supported language. To add one, create its file and add a line here. */
export const DICTIONARIES = { en, fil, es, fr, de, pt, id, zh, ja } satisfies Record<string, Dictionary>;

export type Locale = keyof typeof DICTIONARIES;

export const DEFAULT_LOCALE: Locale = "en";
export const SUPPORTED_LOCALES = Object.keys(DICTIONARIES) as Locale[];
