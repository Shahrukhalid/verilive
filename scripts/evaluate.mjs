// Runs Verilive's detectors over a folder of labelled videos and reports how well they separate real from fake.
//
//   npm run build
//   npm run evaluate -- <folder> [options]       (folder holds real/ and fake/ subfolders)
//   npm run evaluate -- --labels labels.csv      (CSV rows: path,real|fake)
//   npm run evaluate -- --self-check             (runs the bundled test videos and checks the result)
//
// Each video is opened in the built app in a headless Chromium, exactly as "Analyze a recording"
// does, and the saved report is read back. Everything stays on this computer: the app is served
// from dist/ on localhost and every other network request is blocked.
import { chromium } from "@playwright/test";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { classify, normalizeLabel, parseLabelsCsv, signalStats, summarize } from "./evaluate-metrics.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".m4v", ".mkv", ".ogv"]);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".task": "application/octet-stream", ".tflite": "application/octet-stream", ".ico": "image/x-icon", ".txt": "text/plain", ".xml": "application/xml", ".webmanifest": "application/manifest+json" };

const HELP = `Usage: npm run evaluate -- <folder> [options]

  <folder>            contains real/ and fake/ subfolders of videos (searched recursively)
  --labels <csv>      instead of folders: CSV with rows "path,real|fake" (paths relative to the CSV)
  --out <file>        JSON report to write (default: evaluation-report.json)
  --csv <file>        per-video CSV to write (default: next to the JSON report)
  --threshold <lvl>   level at which a video counts as fake: elevated (default) or high
  --flag-at <0..1>    suspicion at which a single signal counts as a "fake" call (default 0.5)
  --jobs <n>          videos analysed in parallel (default 1; each runs in real time)
  --timeout <s>       give up on a video after this many seconds (default 900)
  --limit <n>         only the first n videos of each label (quick trial runs)
  --self-check        evaluate the bundled test videos and fail unless they are classified correctly
  -h, --help          this text

Needs a build (npm run build) and Chromium. Set PW_CHROMIUM_PATH to use a specific browser binary.`;

function fail(msg) {
  console.error(`evaluate: ${msg}`);
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const st = statSync(p); // follows symlinks
    if (st.isDirectory()) out.push(...walk(p));
    else if (st.isFile() && VIDEO_EXT.has(extname(e.name).toLowerCase())) out.push(p);
  }
  return out.sort();
}

/** Collects { path, label } from real/ and fake/ subfolders (any letter case). */
function fromFolders(folder) {
  const out = [];
  for (const e of readdirSync(folder, { withFileTypes: true })) {
    const label = statSync(join(folder, e.name)).isDirectory() ? normalizeLabel(e.name) : null;
    if (label === "real" || label === "fake") for (const path of walk(join(folder, e.name))) out.push({ path, label });
  }
  return out;
}

function fromCsv(csvPath) {
  const { rows, errors } = parseLabelsCsv(readFileSync(csvPath, "utf8"));
  if (errors.length) fail(`bad labels file:\n  ${errors.join("\n  ")}`);
  const base = dirname(resolve(csvPath));
  return rows.map((r) => ({ path: resolve(base, r.path), label: r.label }));
}

/** Serves dist/ on localhost under the same base path the build was made for. */
function serveDist() {
  const dist = join(ROOT, "dist");
  const indexFile = join(dist, "index.html");
  if (!existsSync(indexFile)) fail("dist/ not found. Run `npm run build` first.");
  const base = readFileSync(indexFile, "utf8").match(/(?:src|href)="(\/[^"]*?)assets\//)?.[1] ?? "/";
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (!url.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    let file = resolve(dist, url.slice(base.length) || "index.html");
    if (file !== dist && !file.startsWith(dist + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ server, url: `http://127.0.0.1:${server.address().port}${base}` })));
}

/** Opens one video in the app and returns its saved report (or an error string). */
async function analyze(browser, appUrl, file, timeoutMs) {
  const context = await browser.newContext({ locale: "en-US", acceptDownloads: true, viewport: { width: 1360, height: 900 } });
  const blocked = [];
  // Nothing may leave this computer: only the local app server is reachable.
  await context.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(appUrl.slice(0, appUrl.indexOf("/", 8))) || u.startsWith("blob:") || u.startsWith("data:")) return route.continue();
    blocked.push(u);
    return route.abort();
  });
  const page = await context.newPage();
  const started = Date.now();
  try {
    await page.goto(appUrl);
    await page.getByLabel("Choose a video file to analyze").setInputFiles(file);
    const done = page.getByRole("heading", { name: "Recording finished" });
    const error = page.locator('[role="alert"].error');
    await done.or(error).first().waitFor({ timeout: timeoutMs });
    if (await error.isVisible()) return { error: (await error.innerText()).trim(), seconds: (Date.now() - started) / 1000, blocked };
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.getByRole("button", { name: "Save report" }).click()]);
    const report = JSON.parse(readFileSync(await download.path(), "utf8"));
    return { report, seconds: (Date.now() - started) / 1000, blocked };
  } catch (e) {
    return { error: String(e?.message ?? e).split("\n")[0], seconds: (Date.now() - started) / 1000, blocked };
  } finally {
    await context.close();
  }
}

const pct = (x) => (x === null || x === undefined ? "n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x) => (x === null || x === undefined ? "n/a" : x.toFixed(2));

function table(headers, rows) {
  const w = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => r.map((c, i) => String(c).padEnd(w[i])).join("  ");
  return [line(headers), line(w.map((n) => "-".repeat(n))), ...rows.map(line)].join("\n");
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function printReport(r) {
  const s = r.summary;
  console.log(`\nVideos: ${r.videos.length} (${s.evaluated} rated, ${s.unrated} without a reading, ${r.videos.filter((v) => v.error).length} failed)`);
  console.log(`A video counts as "fake" when its worst-rated person is ${r.options.threshold} or higher.\n`);
  console.log(`Accuracy ${pct(s.accuracy)}   Precision ${pct(s.precision)}   Recall ${pct(s.recall)}   Specificity ${pct(s.specificity)}   F1 ${pct(s.f1)}\n`);
  console.log(table(["", "predicted fake", "predicted real"], [["actually fake", s.tp, s.fn], ["actually real", s.fp, s.tn]]));
  console.log("\nPer signal (a signal flags a video at suspicion >= " + r.options.flagAt + ", counting only confident readings):\n");
  console.log(
    table(
      ["signal", "measured", "mean real", "mean fake", "precision", "recall"],
      r.signals.map((x) => [x.signal, `${x.measured} (${pct(x.coverage)})`, num(x.meanSuspicionReal), num(x.meanSuspicionFake), pct(x.precision), pct(x.recall)]),
    ),
  );
  console.log("\nThese are heuristic signals, not proof; small or unrepresentative sets say little about real-world accuracy.");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      labels: { type: "string" },
      out: { type: "string", default: "evaluation-report.json" },
      csv: { type: "string" },
      threshold: { type: "string", default: "elevated" },
      "flag-at": { type: "string", default: "0.5" },
      jobs: { type: "string", default: "1" },
      timeout: { type: "string", default: "900" },
      limit: { type: "string" },
      "self-check": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) return console.log(HELP);
  if (!["elevated", "high"].includes(values.threshold)) fail("--threshold must be elevated or high");
  const flagAt = Number(values["flag-at"]);
  const jobs = Math.max(1, Math.floor(Number(values.jobs)) || 1);
  const timeoutMs = Math.max(10, Number(values.timeout) || 900) * 1000;
  if (!(flagAt >= 0 && flagAt <= 1)) fail("--flag-at must be between 0 and 1");

  let tempDir;
  let items;
  let out = values.out;
  if (values["self-check"]) {
    // Link the bundled fixtures into real/ and fake/. pulse-sim has a simulated 72 bpm pulse; the others imitate a photo and a pasted face.
    tempDir = mkdtempSync(join(tmpdir(), "verilive-eval-"));
    for (const [sub, file] of [["real", "pulse-sim.webm"], ["fake", "photo-replay.webm"], ["fake", "face-swap-sim.webm"]]) {
      mkdirSync(join(tempDir, sub), { recursive: true });
      symlinkSync(join(ROOT, "tests/e2e/fixtures", file), join(tempDir, sub, file));
    }
    items = fromFolders(tempDir);
    if (!values.out || values.out === "evaluation-report.json") out = join(tempDir, "report.json");
  } else if (values.labels) {
    if (!existsSync(values.labels)) fail(`labels file not found: ${values.labels}`);
    items = fromCsv(values.labels);
  } else {
    const folder = positionals[0];
    if (!folder) return console.log(HELP);
    if (!existsSync(folder) || !statSync(folder).isDirectory()) fail(`not a folder: ${folder}`);
    items = fromFolders(folder);
  }
  if (values.limit) {
    const n = Math.max(1, Math.floor(Number(values.limit)));
    const seen = { real: 0, fake: 0 };
    items = items.filter((i) => ++seen[i.label] <= n);
  }
  const missing = items.filter((i) => !existsSync(i.path));
  if (missing.length) fail(`files not found:\n  ${missing.map((m) => m.path).join("\n  ")}`);
  if (!items.some((i) => i.label === "real") || !items.some((i) => i.label === "fake")) fail("need at least one real and one fake video (folders real/ and fake/, or a labels CSV).");

  const { server, url } = await serveDist();
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      const res = await analyze(browser, url, item.path, timeoutMs);
      const people = res.report?.people ?? [];
      const c = res.error ? { predicted: null, worstLevel: "error", score: null } : classify(people, values.threshold);
      results[i] = { path: item.path, label: item.label, ...c, people, error: res.error ?? null, seconds: Math.round(res.seconds * 10) / 10, blockedRequests: res.blocked };
      console.log(`[${++done}/${items.length}] ${item.label.padEnd(4)} -> ${(c.predicted ?? "no reading").padEnd(10)} ${basename(item.path)}${res.error ? `  (${res.error})` : ""}`);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, worker));
  } finally {
    await browser.close();
    server.close();
  }

  const base = tempDir ?? process.cwd();
  const rel = (p) => relative(base, p).split(sep).join("/");
  const report = {
    tool: "Verilive evaluation",
    createdAt: new Date().toISOString(),
    options: { threshold: values.threshold, flagAt },
    summary: summarize(results),
    signals: signalStats(results, { flagAt }),
    videos: results.map((r) => ({ ...r, path: rel(r.path) })),
  };
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  const csvPath = values.csv ?? out.replace(/\.json$/i, "") + ".csv";
  const header = ["path", "label", "predicted", "worst_level", "score", "error", "seconds", ...(report.signals.map((s) => `suspicion_${s.signal}`))];
  const lines = report.videos.map((v) => {
    const worst = v.people.find((p) => p.level === v.worstLevel);
    const cells = report.signals.map((s) => worst?.signals.find((x) => x.id === s.signal)?.suspicion ?? "");
    return [v.path, v.label, v.predicted ?? "", v.worstLevel, v.score ?? "", v.error ?? "", v.seconds, ...cells].map(csvCell).join(",");
  });
  writeFileSync(csvPath, [header.join(","), ...lines].join("\n") + "\n");

  printReport(report);
  console.log(`\nWrote ${out} and ${csvPath}`);
  const leaked = results.flatMap((r) => r.blockedRequests);
  if (leaked.length) console.log(`Blocked ${leaked.length} non-local request(s); the app should make none.`);

  if (values["self-check"]) {
    const wrong = report.videos.filter((v) => v.predicted !== (v.label === "fake" ? "fake" : "real"));
    for (const sub of ["real", "fake"]) rmSync(join(tempDir, sub), { recursive: true, force: true }); // only the links; the report stays
    if (wrong.length || leaked.length) fail(`self-check failed: ${wrong.map((w) => `${w.path} (${w.label} -> ${w.predicted})`).join(", ") || "network requests were made"}`);
    console.log("Self-check passed.");
  }
}

await main();
