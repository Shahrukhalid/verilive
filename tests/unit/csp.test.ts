import { describe, expect, it } from "vitest";
import { injectCsp } from "../../scripts/csp";

describe("injectCsp", () => {
  it("inserts the policy after a real charset tag", () => {
    const out = injectCsp('<head><meta charset="UTF-8" /><title>x</title></head>');
    expect(out).toContain("Content-Security-Policy");
    expect(out.indexOf("Content-Security-Policy")).toBeGreaterThan(out.indexOf("charset"));
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<title>"));
  });

  it("fails when the only charset tag is commented out", () => {
    expect(() => injectCsp('<head><!-- <meta charset="UTF-8" /> --></head>')).toThrow(/charset/);
  });

  it("ignores a commented charset and uses the real one", () => {
    const out = injectCsp('<head><!-- <meta charset="utf-8"> --><meta charset="utf-8"></head>');
    const comment = out.indexOf("-->");
    expect(out.indexOf("Content-Security-Policy")).toBeGreaterThan(comment);
  });

  it("fails when there is no charset tag", () => {
    expect(() => injectCsp("<head></head>")).toThrow();
  });
});
