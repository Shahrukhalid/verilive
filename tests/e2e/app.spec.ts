import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

async function analyzeFile(page: Page, name: string) {
  await page.goto("./");
  await page.getByLabel("Choose a video file to analyze").setInputFiles(fixture(name));
  await expect(page.getByTestId("session")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("person-1")).toBeVisible({ timeout: 30_000 });
}

async function waitForEnd(page: Page) {
  await expect(page.getByTestId("status")).toContainText("Finished", { timeout: 90_000 });
}

async function report(page: Page) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save report" }).click()]);
  return JSON.parse(readFileSync((await download.path())!, "utf8"));
}

test("home page explains the tool and enforces a strict content policy", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1")) external.push(r.url());
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("really there");
  await expect(page.getByTestId("start-screen")).toBeVisible();
  await expect(page.getByText("Signals, not proof.", { exact: true })).toBeVisible();
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("connect-src 'self'");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test.describe("Spanish browser language", () => {
  test.use({ locale: "es-ES" });

  test("shows translated home copy and sets the document language", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿La persona de tu videollamada");
    await expect(page.getByText("Señales, no pruebas.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Analizar una llamada en directo" })).toBeVisible();
  });
});

test("a photo held up to the camera is flagged", async ({ page }) => {
  await analyzeFile(page, "photo-replay.webm");
  await waitForEnd(page);
  const r = await report(page);
  const p = r.people[0];
  expect(["elevated", "high"]).toContain(p.level);
  const pulse = p.signals.find((s: { id: string }) => s.id === "pulse");
  expect(pulse.suspicion).toBeGreaterThan(0.45);
  const blink = p.signals.find((s: { id: string }) => s.id === "blink");
  expect(blink.metrics.count).toBe(0);
});

test("a simulated pulse is found at the right heart rate", async ({ page }) => {
  await analyzeFile(page, "pulse-sim.webm");
  await waitForEnd(page);
  const r = await report(page);
  const pulse = r.people[0].signals.find((s: { id: string }) => s.id === "pulse");
  expect(Math.abs(pulse.metrics.bpm - 72)).toBeLessThanOrEqual(6);
  expect(pulse.suspicion).toBeLessThan(0.4);
  expect(r.people[0].level).toBe("low");
  // The report holds numbers only, never pixels.
  expect(JSON.stringify(r)).not.toMatch(/data:image|base64/);
});

test("a pasted, re-rendered face is flagged by the artifact checks", async ({ page }) => {
  await analyzeFile(page, "face-swap-sim.webm");
  await waitForEnd(page);
  const r = await report(page);
  const p = r.people[0];
  expect(["elevated", "high"]).toContain(p.level);
  const sig = (id: string) => p.signals.find((s: { id: string }) => s.id === id);
  expect(sig("texture").suspicion).toBeGreaterThan(0.5);
  expect(sig("flicker").suspicion).toBeGreaterThan(0.2);
  await expect(page.getByTestId("person-1").getByTestId("level")).toHaveText(/warning|synthetic/i);
});

test("small faces (gallery view) are found by zooming in automatically", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Choose a video file to analyze").setInputFiles(fixture("small-face.webm"));
  await expect(page.getByTestId("zoom")).toContainText("Zoomed in automatically", { timeout: 30_000 });
  await expect(page.getByTestId("person-1")).toBeVisible();
  await page.getByRole("button", { name: "Use whole video" }).click();
  await expect(page.getByText("Tip: drag a box around a person")).toBeVisible();
});

test("camera mode starts and asks for a face when none is visible", async ({ page }) => {
  await page.goto("./");
  await page.getByTestId("start-camera").click();
  await expect(page.getByTestId("session")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("no-face")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /End/ }).click();
  await expect(page.getByTestId("start-camera")).toBeVisible();
});

test("works on a phone-sized screen without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("./");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(376);
});
