import { bandpass, clamp, dominantPeak, mean, pearson, powerSpectrum, ramp, resampleUniform, round, std } from "./dsp";
import type { FaceFrame, RGB, SignalResult } from "./types";

/** Heart rates between 42 and 180 beats per minute. */
const LO_HZ = 0.7;
const HI_HZ = 3.0;
const FS = 15;

/**
 * Plane-Orthogonal-to-Skin (POS) remote pulse extraction (Wang et al., 2017).
 * Input: uniformly sampled RGB means of a skin region. Output: pulse waveform.
 */
export function pos(rgb: RGB[], fs: number): number[] {
  const n = rgb.length;
  const win = Math.max(8, Math.round(1.6 * fs));
  const h = new Array<number>(n).fill(0);
  if (n < win) return h;
  for (let start = 0; start + win <= n; start++) {
    const seg = rgb.slice(start, start + win);
    const m: RGB = [mean(seg.map((c) => c[0])), mean(seg.map((c) => c[1])), mean(seg.map((c) => c[2]))];
    if (!m[0] || !m[1] || !m[2]) continue;
    const s1: number[] = [];
    const s2: number[] = [];
    for (const c of seg) {
      const r = c[0] / m[0];
      const g = c[1] / m[1];
      const b = c[2] / m[2];
      s1.push(g - b);
      s2.push(g + b - 2 * r);
    }
    const a = std(s2) > 1e-9 ? std(s1) / std(s2) : 0;
    const hs = s1.map((v, i) => v + a * s2[i]!);
    const hm = mean(hs);
    for (let i = 0; i < win; i++) h[start + i] = h[start + i]! + (hs[i]! - hm);
  }
  return h;
}

interface Series {
  t: number[];
  rgb: RGB[];
}

function regionSeries(frames: FaceFrame[], pick: (f: FaceFrame) => RGB | null): Series {
  const t: number[] = [];
  const rgb: RGB[] = [];
  for (const f of frames) {
    const c = pick(f);
    if (c) {
      t.push(f.t);
      rgb.push(c);
    }
  }
  return { t, rgb };
}

function uniformRgb(s: Series): RGB[] {
  const r = resampleUniform(s.t, s.rgb.map((c) => c[0]), FS);
  const g = resampleUniform(s.t, s.rgb.map((c) => c[1]), FS);
  const b = resampleUniform(s.t, s.rgb.map((c) => c[2]), FS);
  return r.map((_, i) => [r[i]!, g[i]!, b[i]!] as RGB);
}

function averageRgb(...cs: (RGB | null)[]): RGB | null {
  const ok = cs.filter((c): c is RGB => !!c);
  if (!ok.length) return null;
  return [mean(ok.map((c) => c[0])), mean(ok.map((c) => c[1])), mean(ok.map((c) => c[2]))];
}

/**
 * Real skin shows a tiny colour change with every heartbeat. Synthetic faces, masks and
 * photos usually lack a clean, consistent pulse, and their regions do not pulse together.
 */
export function analyzePulse(frames: FaceFrame[]): SignalResult {
  const base: Omit<SignalResult, "suspicion" | "confidence" | "detail" | "metrics"> = { id: "pulse", label: "Pulse in skin colour" };
  const all = regionSeries(frames, (f) => averageRgb(f.forehead, f.leftCheek, f.rightCheek));
  const duration = all.t.length > 1 ? all.t[all.t.length - 1]! - all.t[0]! : 0;
  const fps = duration > 0 ? (all.t.length - 1) / duration : 0;
  if (duration < 5 || fps < 4) {
    return { ...base, suspicion: 0, confidence: 0, detail: "Collecting a few seconds of skin colour to look for a pulse.", metrics: { duration, fps } };
  }

  const wave = bandpass(pos(uniformRgb(all), FS), FS, LO_HZ, HI_HZ);
  const peak = dominantPeak(powerSpectrum(wave, FS), LO_HZ, HI_HZ);
  const snr = Number.isFinite(peak.snrDb) ? peak.snrDb : -20;

  // Do forehead and cheeks pulse together? Real blood flow reaches them almost in sync.
  // Only frames where both regions were measured, so the two waves share one time base.
  const both = frames.filter((f) => f.forehead && (f.leftCheek || f.rightCheek));
  const fh = regionSeries(both, (f) => f.forehead);
  const ch = regionSeries(both, (f) => averageRgb(f.leftCheek, f.rightCheek));
  let coherence = 0;
  if (fh.t.length > FS * 4 && ch.t.length > FS * 4) {
    const a = bandpass(pos(uniformRgb(fh), FS), FS, LO_HZ, HI_HZ);
    const b = bandpass(pos(uniformRgb(ch), FS), FS, LO_HZ, HI_HZ);
    const n = Math.min(a.length, b.length);
    coherence = pearson(a.slice(0, n), b.slice(0, n));
  }

  const snrSusp = ramp(snr, 2, -4); // clear pulse (>= 2 dB) -> 0, none (<= -4 dB) -> 1
  const cohSusp = ramp(coherence, 0.45, 0.05);
  const suspicion = clamp(0.5 * snrSusp + 0.5 * cohSusp);

  const motion = mean(frames.map((f) => f.motion));
  const size = mean(frames.map((f) => f.faceWidthPx));
  const confidence = clamp(ramp(duration, 5, 15) * ramp(fps, 4, 10) * ramp(size, 40, 100) * (1 - ramp(motion, 0.02, 0.08)) * 0.95);

  const bpm = Math.round(peak.freq * 60);
  const detail =
    suspicion < 0.35
      ? `Natural pulse found (about ${bpm} bpm) and the face regions beat together.`
      : suspicion < 0.65
        ? `Weak pulse signal. This is common with heavy video compression or poor lighting.`
        : `No consistent pulse in the skin colour, as seen in replayed or generated faces.`;
  return { ...base, suspicion, confidence, detail, metrics: { bpm, snrDb: round(snr), coherence: round(coherence), duration: round(duration), fps: round(fps) } };
}

