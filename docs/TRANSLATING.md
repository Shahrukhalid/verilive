# Translating Verilive

Verilive shows its interface in the visitor's language. There is no i18n library: the
whole system is a few small files in [`src/i18n/`](../src/i18n).

## How it works

| Piece | File | Does one thing |
| --- | --- | --- |
| Dictionaries | `src/i18n/locales/*.ts` | One file per language: message key to text. `en.ts` is the source of truth. |
| Language detection | `src/i18n/detect.ts` | Picks a supported language from `navigator.languages` / `navigator.language`. Knows nothing about dictionaries. |
| Translation function | `src/i18n/translate.ts` | Looks a key up, fills `{placeholders}`, picks plural forms. |
| Wiring | `src/i18n/index.ts`, `src/i18n/react.tsx` | Builds a translator per language and hands it to React (`useI18n()`). |

**Detection.** The first language in the browser's preference list that Verilive supports
wins; the region is ignored (`es-MX` gives Spanish, `pt-BR` gives Portuguese). `tl` is read
as Filipino and `in` as Indonesian. If nothing matches, the interface is in English.
`<html lang>` is set to the chosen language.

**Missing translations never break the page.** A key missing from a language falls back to
the English text, and a key missing everywhere shows the key itself.

**What is translated.** All text in `src/ui/*.tsx`, the four risk levels (title and advice),
the signal names, the detector's detail sentences, and the summary you copy to the
clipboard. The saved JSON report stays in English on purpose, so it has one stable format
for other tools; it also carries each sentence's `detailKey` and `detailParams`.

## Supported languages

English (default), Filipino (`fil`), Spanish (`es`), French (`fr`), German (`de`),
Portuguese (`pt`), Indonesian (`id`), Chinese, Simplified (`zh`) and Japanese (`ja`).
Every Chinese variant currently shows the Simplified translation.

## Add a new language

Say you want Italian (`it`).

1. Copy `src/i18n/locales/en.ts` to `src/i18n/locales/it.ts`, then change it to:

   ```ts
   import type { Dictionary } from "../types";

   /** Italiano */
   export const it: Dictionary = {
     "app.brandTag": "controllo deepfake",
     // ...every other key
   };
   ```

   Typing it as `Dictionary` makes TypeScript list every key you have not translated yet.

2. Register it in `src/i18n/locales/index.ts`:

   ```ts
   import { it } from "./it";
   export const DICTIONARIES = { en, fil, es, fr, de, pt, id, zh, ja, it } satisfies Record<string, Dictionary>;
   ```

   Detection and the tests pick it up from there. Nothing else needs to change.

3. Run `npm run check`. The unit tests fail if your file has a missing or empty key, or if
   a message's `{placeholders}` differ from the English one.

### Translation rules

- Keep `{placeholders}` exactly as written (`{count}`, `{percent}`, `{message}`). You can
  move them around the sentence.
- Keys ending in `.one` / `.other` are plural forms, chosen with the language's own
  plural rules. A language with one form (Chinese, Japanese, Indonesian) puts the same
  text in both.
- Where one message quotes another (for example `home.step2.text` mentions the button
  `home.screen.title`), use the exact words of your translation of that button.
- Do not translate product names (Verilive, Zoom, Google Meet, Teams, Webex, GitHub).

## Add or change an English message

1. Add the key to `src/i18n/locales/en.ts`. TypeScript now reports every other language
   as incomplete.
2. Add the translation to each file in `src/i18n/locales/`.
3. Use it in a component with `const { t } = useI18n();` then `t("your.key", { id })`.
   Keys are type-checked, so a typo is a compile error.

For a new **detector sentence**, build it with `describe("detail.xxx", params)` from
`src/i18n`. It returns the English text (`detail`, used in reports and tests) together with
the key and parameters the interface translates.

## Tests

- `tests/unit/i18n.test.ts` (Vitest): dictionary completeness and placeholders, language
  detection, English fallback, missing-key behaviour, plurals, detector sentences, and the
  English report versus the translated summary.
- `tests/e2e/i18n.spec.ts` (Playwright): sets the browser language and checks that the
  page, a real analysis session and the copied summary render in that language, and that
  an unsupported language gives English.
