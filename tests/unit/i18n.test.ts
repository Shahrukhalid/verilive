import { describe, expect, it } from "vitest";
import { FaceAnalyzer } from "../../src/engine/analyzer";
import { DEFAULT_LOCALE, DICTIONARIES, SUPPORTED_LOCALES, browserLocale, createTranslator, describe as describeDetail, detectLocale, interpolate, tEn, translatorFor, type Dictionary, type Locale, type TranslationKey } from "../../src/i18n";
import { primaryLanguage } from "../../src/i18n/detect";
import { buildReport, summaryText } from "../../src/ui/report";
import { FaceTracker } from "../../src/engine/analyzer";
import { naturalBlinks, synthFrames } from "./synth";

const en = DICTIONARIES.en as Dictionary;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("dictionaries", () => {
  it("supports English, Filipino, Spanish and other widely used languages", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(SUPPORTED_LOCALES).toEqual(expect.arrayContaining(["en", "fil", "es", "fr", "de", "pt", "id", "zh", "ja"]));
  });

  it.each(SUPPORTED_LOCALES)("%s has exactly the same keys as English, none empty", (locale) => {
    const dict = DICTIONARIES[locale] as Dictionary;
    expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(dict)) expect(value.trim(), `${locale}:${key}`).not.toBe("");
  });

  it.each(SUPPORTED_LOCALES)("%s uses the same {placeholders} as English in every message", (locale) => {
    const dict = DICTIONARIES[locale] as Dictionary;
    for (const key of Object.keys(en) as (keyof Dictionary)[]) expect(placeholders(dict[key]), `${locale}:${key}`).toEqual(placeholders(en[key]));
  });

  it("every plural message has both a .one and an .other form", () => {
    const bases = Object.keys(en).filter((k) => k.endsWith(".one") || k.endsWith(".other")).map((k) => k.replace(/\.(one|other)$/, ""));
    for (const base of new Set(bases)) {
      expect(en).toHaveProperty([`${base}.one`]);
      expect(en).toHaveProperty([`${base}.other`]);
    }
  });
});

describe("language detection", () => {
  const pick = (preferred: Parameters<typeof detectLocale>[0]) => detectLocale(preferred, SUPPORTED_LOCALES, DEFAULT_LOCALE);

  it("picks a supported language and ignores the region", () => {
    expect(pick("es")).toBe("es");
    expect(pick("es-MX")).toBe("es");
    expect(pick("pt-BR")).toBe("pt");
    expect(pick("zh-CN")).toBe("zh");
    expect(pick("ja-JP")).toBe("ja");
  });

  it("is case and separator tolerant", () => {
    expect(pick("ES-mx")).toBe("es");
    expect(pick("fr_CA")).toBe("fr");
  });

  it("maps Filipino and its alternative codes", () => {
    expect(pick("fil")).toBe("fil");
    expect(pick("fil-PH")).toBe("fil");
    expect(pick("tl")).toBe("fil");
    expect(pick("tl-PH")).toBe("fil");
    expect(primaryLanguage("in")).toBe("id");
  });

  it("falls back to English for unsupported or unusable input", () => {
    expect(pick("sw-KE")).toBe("en");
    expect(pick("")).toBe("en");
    expect(pick("not a language")).toBe("en");
    expect(pick(undefined)).toBe("en");
    expect(pick(null)).toBe("en");
    expect(pick([])).toBe("en");
  });

  it("honours the order of a preference list, skipping unsupported entries", () => {
    expect(pick(["sw", "de-AT", "es"])).toBe("de");
    expect(pick(["sw", "xx"])).toBe("en");
  });

  it("reads the browser's languages, then its single language", () => {
    expect(browserLocale({ language: "fr-FR", languages: ["fr-FR", "en"] })).toBe("fr");
    expect(browserLocale({ language: "es-ES", languages: [] })).toBe("es");
    expect(browserLocale({ language: "sw", languages: ["sw"] })).toBe("en");
    expect(browserLocale(undefined)).toBe("en");
  });
});

describe("translation", () => {
  it("looks a message up and fills in its placeholders", () => {
    expect(tEn("person.title", { id: 2 })).toBe("Person 2");
    expect(translatorFor("es")("person.title", { id: 2 })).toBe("Persona 2");
    expect(translatorFor("fil")("level.high.title")).toBe(DICTIONARIES.fil["level.high.title"]);
  });

  it("leaves an unknown placeholder visible rather than hiding it", () => {
    expect(interpolate("Hello {name}, {missing}", { name: "Ana" })).toBe("Hello Ana, {missing}");
    expect(interpolate("No params {x}")).toBe("No params {x}");
  });

  it("falls back to English when a language lacks a message", () => {
    const partial = createTranslator("es", { "person.title": "Persona {id}" }, en);
    expect(partial("person.title", { id: 1 })).toBe("Persona 1");
    expect(partial("level.low.title")).toBe("Looks real");
  });

  it("returns the key itself for a message that exists nowhere, never throwing", () => {
    const t = createTranslator("es", {}, en);
    expect(t("does.not.exist" as TranslationKey)).toBe("does.not.exist");
    expect(t("does.not.exist" as TranslationKey, { count: 3 })).toBe("does.not.exist");
  });

  it("chooses the plural form from a numeric count", () => {
    expect(tEn("session.faces", { count: 1 })).toBe("1 face in view");
    expect(tEn("session.faces", { count: 3 })).toBe("3 faces in view");
    expect(translatorFor("es")("session.faces", { count: 1 })).toBe("1 cara a la vista");
    expect(translatorFor("es")("session.faces", { count: 0 })).toBe("0 caras a la vista");
    expect(translatorFor("ja")("session.faces", { count: 1 })).toBe("1 人の顔が映っています");
  });

  it("every locale can translate every key without leaving a placeholder behind", () => {
    const params = { count: 2, id: 1, title: "T", percent: 5, seconds: 5, bpm: 70, perMinute: 12, message: "m", theme: "x", version: "1", date: "d", minutes: 3, source: "s", verdict: "v", risk: 1, evidence: 1 };
    for (const locale of SUPPORTED_LOCALES as Locale[]) {
      const t = translatorFor(locale);
      for (const key of Object.keys(en)) expect(t(key as TranslationKey, params), `${locale}:${key}`).not.toMatch(/\{\w+\}/);
    }
  });
});

describe("detector detail sentences", () => {
  it("keep their English text and also carry a key for translation", () => {
    const d = describeDetail("detail.pulse.natural", { bpm: 72 });
    expect(d.detail).toBe("Natural pulse found (about 72 bpm) and the face regions beat together.");
    expect(d.detailKey).toBe("detail.pulse.natural");
    expect(d.detailParams).toEqual({ bpm: 72 });
  });

  it("every signal an analyzer produces can be shown in another language", () => {
    const a = new FaceAnalyzer();
    for (const f of synthFrames({ seconds: 45, blinks: naturalBlinks(45) })) a.push(f);
    const r = a.assess(45, "balanced");
    expect(r.signals).toHaveLength(6);
    const es = translatorFor("es");
    for (const s of r.signals) {
      expect(s.detailKey, s.id).toBeDefined();
      expect(tEn(s.detailKey!, s.detailParams)).toBe(s.detail);
      expect(es(s.detailKey!, s.detailParams)).not.toBe(s.detail);
      expect(en).toHaveProperty([`signal.${s.id}`]);
    }
  });

  it("a frozen photo's reasons point at translatable signals", () => {
    const a = new FaceAnalyzer();
    for (const f of synthFrames({ seconds: 45, bpm: 0, blinks: [] })) a.push(f);
    const r = a.assess(45, "balanced");
    expect(r.reasonIds.length).toBe(r.reasons.length);
    expect(r.reasons.length).toBeGreaterThan(0);
    for (const [i, id] of r.reasonIds.entries()) expect(r.signals.find((s) => s.id === id)!.detail).toBe(r.reasons[i]);
  });

  it("the blink count uses the right plural in each language", () => {
    expect(tEn("detail.blink.natural", { count: 1, perMinute: 10 })).toBe("1 natural-looking blink (10 per minute).");
    expect(tEn("detail.blink.natural", { count: 4, perMinute: 10 })).toBe("4 natural-looking blinks (10 per minute).");
  });
});

describe("report and copied summary", () => {
  function session() {
    const tracker = new FaceTracker();
    tracker.assign([{ x: 0.3, y: 0.2, w: 0.2, h: 0.3 }], 0);
    const analyzer = tracker.analyzer(1)!;
    for (const f of synthFrames({ seconds: 45, bpm: 0, blinks: [] })) analyzer.push(f);
    analyzer.assess(45, "balanced");
    return tracker;
  }
  const info = { kind: "file" as const, label: "call.mp4", startedAt: new Date("2026-01-01T10:00:00Z"), seconds: 120, sensitivity: "balanced" as const };

  it("keeps the saved JSON report in English whatever the language", () => {
    const r = buildReport(info, session());
    expect(r.note).toBe(DICTIONARIES.en["report.note"]);
    expect(r.people[0]!.verdict).toBe(DICTIONARIES.en[`level.${r.people[0]!.level}.title`]);
  });

  it("writes the copied summary in the reader's language", () => {
    const r = buildReport(info, session());
    const english = summaryText(r);
    const spanish = summaryText(r, translatorFor("es"));
    expect(english).toContain("Person 1:");
    expect(spanish).toContain("Persona 1:");
    expect(spanish).toContain(DICTIONARIES.es["report.note"]);
    expect(spanish).not.toContain("Person 1");
    expect(spanish.split("\n").length).toBe(english.split("\n").length);
  });
});
