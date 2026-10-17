/** Small, dependency-free signal processing helpers used by the detectors. */

export function mean(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i]!;
  return xs.length ? s / xs.length : 0;
}

export function std(xs: ArrayLike<number>): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += (xs[i]! - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function clamp(x: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, x));
}

export function round(x: number, d = 3): number {
  const k = 10 ** d;
  return Math.round(x * k) / k;
}

/** Linear map of x from [a, b] to [0, 1], clamped. Works for a > b too. */
export function ramp(x: number, a: number, b: number): number {
  return clamp((x - a) / (b - a));
}

/** Removes the best-fit straight line. */
export function detrend(xs: number[]): number[] {
  const n = xs.length;
  if (n < 2) return xs.map(() => 0);
  const mx = (n - 1) / 2;
  const my = mean(xs);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (xs[i]! - my);
    den += (i - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  return xs.map((x, i) => x - (my + slope * (i - mx)));
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i]! - ma;
    const db = b[i]! - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

/**
 * Resamples irregular samples (t in seconds) onto a uniform grid at `fs` Hz.
 * Video frames arrive with jitter, while spectral analysis needs even spacing.
 */
export function resampleUniform(t: number[], v: number[], fs: number): number[] {
  const n = Math.min(t.length, v.length);
  if (n < 2) return [];
  const t0 = t[0]!;
  const t1 = t[n - 1]!;
  const count = Math.floor((t1 - t0) * fs) + 1;
  const out = new Array<number>(count);
  let j = 0;
  for (let k = 0; k < count; k++) {
    const tk = t0 + k / fs;
    while (j < n - 2 && t[j + 1]! < tk) j++;
    const ta = t[j]!;
    const tb = t[j + 1]!;
    const f = tb > ta ? (tk - ta) / (tb - ta) : 0;
    out[k] = v[j]! + clamp(f) * (v[j + 1]! - v[j]!);
  }
  return out;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place iterative radix-2 FFT. `re` and `im` must have the same power-of-two length. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k]!;
        const ai = im[i + k]!;
        const br = re[i + k + len / 2]! * cr - im[i + k + len / 2]! * ci;
        const bi = re[i + k + len / 2]! * ci + im[i + k + len / 2]! * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] = re[i]! / n;
      im[i] = im[i]! / n;
    }
  }
}

/** Zero-phase band-pass by masking the spectrum. Good enough for short physiological windows. */
export function bandpass(xs: number[], fs: number, lo: number, hi: number): number[] {
  const n = xs.length;
  if (n < 4) return xs.slice();
  const size = nextPow2(n * 2);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const m = mean(xs);
  for (let i = 0; i < n; i++) re[i] = xs[i]! - m;
  fft(re, im);
  for (let k = 0; k < size; k++) {
    const f = (Math.min(k, size - k) * fs) / size;
    if (f < lo || f > hi) {
      re[k] = 0;
      im[k] = 0;
    }
  }
  fft(re, im, true);
  return Array.from(re.subarray(0, n));
}

export interface Spectrum {
  freqs: number[];
  power: number[];
}

/** Power spectrum with a Hann window and zero padding (for finer peak location). */
export function powerSpectrum(xs: number[], fs: number, pad = 4): Spectrum {
  const n = xs.length;
  const size = nextPow2(Math.max(n * pad, 256));
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const m = mean(xs);
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, n - 1));
    re[i] = (xs[i]! - m) * w;
  }
  fft(re, im);
  const half = size / 2;
  const freqs: number[] = [];
  const power: number[] = [];
  for (let k = 0; k <= half; k++) {
    freqs.push((k * fs) / size);
    power.push(re[k]! ** 2 + im[k]! ** 2);
  }
  return { freqs, power };
}

export interface Peak {
  freq: number;
  /** Ratio of power near the peak (and its first harmonic) to the rest of the band, in dB. */
  snrDb: number;
}

/** Finds the strongest frequency in [lo, hi] and its signal-to-noise ratio (de Haan style). */
export function dominantPeak(spec: Spectrum, lo: number, hi: number, halfWidth = 0.12): Peak {
  let best = -1;
  let bestP = -1;
  for (let k = 0; k < spec.freqs.length; k++) {
    const f = spec.freqs[k]!;
    if (f >= lo && f <= hi && spec.power[k]! > bestP) {
      bestP = spec.power[k]!;
      best = k;
    }
  }
  if (best < 0) return { freq: 0, snrDb: -Infinity };
  const f0 = spec.freqs[best]!;
  let sig = 0;
  let noise = 0;
  for (let k = 0; k < spec.freqs.length; k++) {
    const f = spec.freqs[k]!;
    if (f < lo || f > hi * 2) continue;
    const near = Math.abs(f - f0) <= halfWidth || Math.abs(f - 2 * f0) <= halfWidth;
    if (near) sig += spec.power[k]!;
    else if (f <= hi) noise += spec.power[k]!;
  }
  const snrDb = noise > 0 ? 10 * Math.log10(sig / noise) : sig > 0 ? 30 : -Infinity;
  return { freq: f0, snrDb };
}
