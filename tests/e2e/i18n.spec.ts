import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { DICTIONARIES } from "../../src/i18n";

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const es = DICTIONARIES.es;
const fil = DICTIONARIES.fil;
const en = DICTIONARIES.en;

test.describe("Spanish browser", () => {
  test.use({ locale: "es-ES" });

  test("the home page renders in Spanish", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(es["home.titleEmphasis"]);
    await expect(page.getByTestId("start-screen")).toContainText(es["home.screen.title"]);
    await expect(page.getByTestId("start-camera")).toContainText(es["home.camera.cta"]);
    await expect(page.getByLabel(es["home.file.aria"])).toBeAttached();
    await expect(page.getByText(es["home.note.lead"], { exact: true })).toBeVisible();
    await expect(page.getByText(en["home.note.lead"], { exact: true })).toHaveCount(0);
  });

  test("the live session, its verdict and the copied summary are in Spanish", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./");
    await page.getByLabel(es["home.file.aria"]).setInputFiles(fixture("photo-replay.webm"));
    await expect(page.getByTestId("session")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("person-1")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("status")).toContainText(es["session.status.ended"], { timeout: 90_000 });
    await expect(page.getByTestId("person-1").getByTestId("level")).toHaveText(new RegExp(`${es["level.elevated.title"]}|${es["level.high.title"]}`));
    // The detector's own sentences are translated too.
    await page.getByTestId("person-1").getByText(es["person.allSignals"]).click();
    await expect(page.getByTestId("person-1")).toContainText(es["signal.pulse"]);
    const card = page.getByTestId("person-1");
    // A replayed photo has a weak or missing pulse, never a natural one.
    const text = await card.innerText();
    expect([es["detail.pulse.weak"], es["detail.pulse.none"]].some((s) => text.includes(s))).toBe(true);
    for (const sentence of [en["detail.pulse.weak"], en["detail.pulse.none"]]) expect(text).not.toContain(sentence);
    await page.getByRole("button", { name: es["session.copy"] }).click();
    await expect(page.getByText(es["session.toast.copied"])).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("Persona 1:");
    expect(copied).toContain(es["report.note"]);
  });
});

test.describe("Filipino browser", () => {
  test.use({ locale: "fil-PH" });

  test("the home page renders in Filipino", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "fil");
    await expect(page.getByTestId("start-screen")).toContainText(fil["home.screen.title"]);
    await expect(page.getByText(fil["home.note.lead"], { exact: true })).toBeVisible();
  });
});

test.describe("unsupported browser language", () => {
  test.use({ locale: "sw-KE" });

  test("falls back to English", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("start-screen")).toContainText(en["home.screen.title"]);
  });
});

test.describe("English browser", () => {
  test.use({ locale: "en-GB" });

  test("keeps the interface in English", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("really there");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
