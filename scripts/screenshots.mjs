// Regenerates README images from the real app: npm run build && node scripts/screenshots.mjs
// Needs `npx vite preview` running on port 4173 and ffmpeg for the GIF.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const URL = "http://127.0.0.1:4173/verilive/";
const OUT = "docs/screenshots";
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });

async function page(scheme = "light", size = { width: 1440, height: 900 }) {
  const p = await browser.newPage({ viewport: size, colorScheme: scheme, deviceScaleFactor: 1 });
  await p.goto(URL);
  return p;
}

async function finished(p, file) {
  await p.getByLabel("Choose a video file to analyze").setInputFiles(`tests/e2e/fixtures/${file}`);
  await p.getByRole("heading", { name: "Recording finished" }).waitFor({ timeout: 90_000 });
  await p.locator("details.signals").first().evaluate((d) => (d.open = true));
  await p.waitForTimeout(500);
}

// Home
{
  const p = await page("light");
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/home.png` });
  await p.close();
}
// Flagged (dark) and real (light) sessions
for (const [file, scheme, name] of [["face-swap-sim.webm", "dark", "flagged"], ["pulse-sim.webm", "light", "real"]]) {
  const p = await page(scheme, { width: 1440, height: 1100 });
  await finished(p, file);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  await p.close();
}

// Animated demo: open a recording and watch the verdict form (sped up).
{
  const raw = "docs/demo-raw";
  rmSync(raw, { recursive: true, force: true });
  mkdirSync(raw, { recursive: true });
  const p = await page("dark", { width: 1280, height: 800 });
  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(`${raw}/${file}`, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 1280, maxHeight: 800 });
  await p.waitForTimeout(1500);
  await p.getByLabel("Choose a video file to analyze").setInputFiles("tests/e2e/fixtures/face-swap-sim.webm");
  await p.getByRole("heading", { name: "Recording finished" }).waitFor({ timeout: 90_000 });
  await p.locator("details.signals").first().evaluate((d) => (d.open = true));
  await p.waitForTimeout(2500);
  await cdp.send("Page.stopScreencast");
  await p.close();
  const lines = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.02, (frames[i + 1]?.t ?? f.t + 1) - f.t).toFixed(3)}`);
  writeFileSync(`${raw}/frames.txt`, lines.join("\n") + `\nfile '${frames.at(-1).file}'\n`);
  const filter = "setpts=PTS/3,fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "frames.txt", "-vf", filter, "-loop", "0", "../demo.gif"], { cwd: raw });
  rmSync(raw, { recursive: true, force: true });
}
await browser.close();
console.log("screenshots written to", OUT, "and docs/demo.gif");
