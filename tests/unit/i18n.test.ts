import { describe, expect, it } from "vitest";
import { formatSignalDetail, messagesFor, resolveLocale } from "../../src/ui/i18n";

describe("interface language", () => {
  it("selects Spanish for regional Spanish browser languages", () => {
    expect(resolveLocale("es-ES")).toBe("es");
    expect(resolveLocale("es_MX")).toBe("es");
  });

  it("falls back to English for unsupported or missing languages", () => {
    expect(resolveLocale("fr-FR")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });

  it("translates dynamic detector details without changing their values", () => {
    const copy = messagesFor("es-ES");
    expect(formatSignalDetail(copy, { key: "pulse.natural", values: { bpm: 72 } })).toContain("72 lpm");
    expect(formatSignalDetail(copy, { key: "blink.none", values: { seconds: 18 } })).toContain("18 segundos");
  });
});
