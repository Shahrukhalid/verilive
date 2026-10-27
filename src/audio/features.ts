/**
 * Experimental voice features. Pure functions on plain numbers, no DOM and no Web Audio, so they
 * run inside an AudioWorklet and in unit tests alike. Nothing here stores or returns audio: a frame
 * of samples goes in and a handful of numbers comes out.
 *
 * These are classic speech-processing measurements (spectral flatness and rolloff, energy in the
 * high band, frame-to-frame spectral change, pitch and level stability). The thresholds that turn
 * them into a reading are starting points, not validated against real call audio.
 */
import { clamp, fft, mean, median, ramp, std } from "../engine/dsp";

/** Samples per analysis frame (about 43 ms at 48 kHz). Frames do not overlap. */
export const FRAME = 2048;
const PAD = FRAME * 2;
const HALF = PAD / 2;
const MIN_F0 = 70;
const MAX_F0 = 400;
const EPS = 1e-12;
/** Frames quieter than this (about -48 dBFS) are treated as silence. */
export const SILENCE_RMS = 0.004;
const VOICED_MIN = 0.45;
/** Above this frequency the spectrum is "high band" for the cutoff measurement. */
export const HIGH_BAND_HZ = 6000;
/** Seconds of voiced speech needed before the indicator says anything. */
export const SPEECH_SECONDS_FOR_FULL_EVIDENCE = 20;
export const MIN_SPEECH_FRACTION = 0.4;

/** The numbers measured on one frame. */
export interface FrameFeatures {
  /** Root-mean-square level, 0..1 for full-scale samples. */
  rms: number;
  /** Geometric over arithmetic mean of the power spectrum (100 Hz up): about 0 for a tone, about 0.5 for white noise. */
  flatness: number;
  /** Frequency below which 95 percent of the spectral power lies, in Hz. */
  rolloffHz: number;
  /** Share of the power above HIGH_BAND_HZ (0 when the stream is band-limited below that). */
  highBandRatio: number;
  /** Spectral flux: change of the normalized spectrum since the previous frame, 0..1. 0 for the first frame. */
  flux: number;
  /** Fundamental frequency in Hz, or 0 when the frame is not clearly voiced. */
  f0: number;
  /** Strength of the periodicity behind f0, 0..1. */
  voicing: number;
}

export const FEATURE_COUNT = 7;

export function frameToArray(f: FrameFeatures): number[] {
  return [f.rms, f.flatness, f.rolloffHz, f.highBandRatio, f.flux, f.f0, f.voicing];
}

export function arrayToFrame(a: ArrayLike<number>, offset = 0): FrameFeatures {
  return { rms: a[offset]!, flatness: a[offset + 1]!, rolloffHz: a[offset + 2]!, highBandRatio: a[offset + 3]!, flux: a[offset + 4]!, f0: a[offset + 5]!, voicing: a[offset + 6]! };
}

export function isVoiced(f: FrameFeatures): boolean {
  return f.f0 > 0 && f.rms >= SILENCE_RMS && f.voicing >= VOICED_MIN;
}

const hann = Float64Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
// Scratch buffers, reused for every frame. A worklet or a test runs one frame at a time.
const re = new Float64Array(PAD);
const im = new Float64Array(PAD);
const power = new Float64Array(HALF + 1);
const acRe = new Float64Array(PAD);
const acIm = new Float64Array(PAD);

/** Autocorrelation of the window itself, to undo the bias the taper puts on long lags. */
const windowAc: Float64Array = (() => {
  const r = new Float64Array(PAD);
  const i = new Float64Array(PAD);
  for (let k = 0; k < FRAME; k++) r[k] = hann[k]!;
  fft(r, i);
  for (let k = 0; k < PAD; k++) {
    r[k] = r[k]! * r[k]! + i[k]! * i[k]!;
    i[k] = 0;
  }
  fft(r, i, true);
  return r;
})();

/**
 * Measures one frame of mono samples (at most FRAME of them; shorter input is zero-padded).
 * `previous` is the normalized spectrum returned for the previous frame, or null.
 * The returned `spectrum` is the argument to pass for the next frame.
 */
export function analyzeFrame(samples: ArrayLike<number>, sampleRate: number, previous: Float64Array | null = null): { features: FrameFeatures; spectrum: Float64Array } {
  const n = Math.min(samples.length, FRAME);
  let sumSq = 0;
  re.fill(0);
  im.fill(0);
  for (let i = 0; i < n; i++) {
    const s = samples[i]!;
    sumSq += s * s;
    re[i] = s * hann[i]!;
  }
  const rms = n ? Math.sqrt(sumSq / n) : 0;
  fft(re, im);
  for (let k = 0; k <= HALF; k++) power[k] = re[k]! * re[k]! + im[k]! * im[k]!;

  const binHz = sampleRate / PAD;
  const k0 = Math.max(1, Math.ceil(100 / binHz));
  const kHigh = Math.ceil(HIGH_BAND_HZ / binHz);

  let logSum = 0;
  let sum = 0;
  let high = 0;
  let count = 0;
  for (let k = k0; k <= HALF; k++) {
    const p = power[k]!;
    logSum += Math.log(p + EPS);
    sum += p;
    if (k >= kHigh) high += p;
    count++;
  }
  const active = rms >= SILENCE_RMS && sum > EPS;
  const flatness = active && count ? Math.exp(logSum / count) / (sum / count + EPS) : 0;
  const highBandRatio = active ? high / sum : 0;

  let rolloffHz = 0;
  if (active) {
    let cum = 0;
    for (let k = k0; k <= HALF; k++) {
      cum += power[k]!;
      if (cum >= 0.95 * sum) {
        rolloffHz = k * binHz;
        break;
      }
    }
  }

  // Normalized magnitude spectrum for the flux, and the output for the next call.
  const spectrum = new Float64Array(HALF + 1);
  let magSum = 0;
  for (let k = 1; k <= HALF; k++) {
    const m = Math.sqrt(power[k]!);
    spectrum[k] = m;
    magSum += m;
  }
  if (magSum > 0) for (let k = 1; k <= HALF; k++) spectrum[k] = spectrum[k]! / magSum;
  let flux = 0;
  if (previous && active) {
    let d = 0;
    for (let k = 1; k <= HALF; k++) d += Math.abs(spectrum[k]! - previous[k]!);
    flux = d / 2;
  }

  // Pitch from the autocorrelation (inverse transform of the power spectrum, zero-padded so it does not wrap).
  let f0 = 0;
  let voicing = 0;
  if (active) {
    for (let k = 0; k <= HALF; k++) {
      acRe[k] = power[k]!;
      acRe[PAD - k] = power[k]!;
    }
    acIm.fill(0);
    fft(acRe, acIm, true);
    const r0 = acRe[0]!;
    const w0 = windowAc[0]!;
    const lo = Math.max(2, Math.floor(sampleRate / MAX_F0));
    const hi = Math.min(HALF - 2, Math.ceil(sampleRate / MIN_F0));
    let best = -1;
    let bestLag = 0;
    const norm = (lag: number) => acRe[lag]! / r0 / (windowAc[lag]! / w0);
    if (r0 > 0) {
      for (let lag = lo; lag <= hi; lag++) {
        const v = norm(lag);
        if (v > best) {
          best = v;
          bestLag = lag;
        }
      }
    }
    if (bestLag > 0) {
      // Multiples of the true period score about as high as the period itself, so take the first
      // clear peak (within 10 percent of the best) rather than the tallest.
      for (let lag = lo; lag < bestLag; lag++) {
        const v = norm(lag);
        if (v >= 0.9 * best && v >= norm(lag - 1) && v >= norm(lag + 1)) {
          bestLag = lag;
          best = v;
          break;
        }
      }
      const a = norm(bestLag - 1);
      const b = norm(bestLag);
      const c = norm(bestLag + 1);
      const denom = a - 2 * b + c;
      const shift = denom < 0 ? clamp(0.5 * (a - c) / denom, -0.5, 0.5) : 0;
      voicing = clamp(best, 0, 1);
      if (voicing >= VOICED_MIN) f0 = sampleRate / (bestLag + shift);
    }
  }

  return { features: { rms, flatness, rolloffHz, highBandRatio, flux, f0, voicing }, spectrum };
}

/** Numbers behind the indicator. Every value is a plain number, safe to put in a report. */
export interface VoiceMetrics {
  flatness: number;
  rolloffHz: number;
  highBandRatio: number;
  /** Mean pitch change between neighbouring voiced frames, in semitones. Low means unusually even pitch. */
  pitchStepSemitones: number;
  /** Mean level change between neighbouring voiced frames (natural log of the ratio). Low means unusually even loudness. */
  levelStep: number;
  /** Variation (std over mean) of the spectral flux. Low means the spectrum changes very evenly. */
  fluxVariation: number;
}

export type VoiceLevel = "collecting" | "low" | "some";

export interface VoiceSnapshot {
  /** Seconds of voiced speech heard so far. */
  speechSeconds: number;
  /** Seconds of audio analyzed so far, speech or not. */
  analyzedSeconds: number;
  /** 0 = nothing unusual, 1 = many traits seen in synthetic voices. */
  suspicion: number;
  /** 0 = not enough speech to say anything, 1 = a good amount of speech heard. */
  confidence: number;
  level: VoiceLevel;
  /** Null until there is enough speech to measure. */
  metrics: VoiceMetrics | null;
}

/**
 * Collects frame features and turns the recent ones into a snapshot. Holds a bounded window of
 * numbers (never audio), so memory stays small however long the call runs.
 */
export class VoiceAggregator {
  private frames: FrameFeatures[] = [];
  private totalFrames = 0;
  private totalVoiced = 0;

  constructor(
    readonly sampleRate: number,
    private readonly maxFrames = 800,
  ) {}

  get frameSeconds(): number {
    return FRAME / this.sampleRate;
  }

  add(f: FrameFeatures): void {
    this.frames.push(f);
    if (this.frames.length > this.maxFrames) this.frames.shift();
    this.totalFrames++;
    if (isVoiced(f)) this.totalVoiced++;
  }

  /** Adds frames from a flat array of FEATURE_COUNT numbers per frame, as the worklet sends them. */
  addFlat(flat: ArrayLike<number>): void {
    for (let o = 0; o + FEATURE_COUNT <= flat.length; o += FEATURE_COUNT) {
      const f = arrayToFrame(flat, o);
      if (Object.values(f).every(Number.isFinite)) this.add(f);
    }
  }

  snapshot(): VoiceSnapshot {
    const fs = this.frameSeconds;
    const speechSeconds = this.totalVoiced * fs;
    const analyzedSeconds = this.totalFrames * fs;
    const confidence = clamp(speechSeconds / SPEECH_SECONDS_FOR_FULL_EVIDENCE);
    const voicedFrames = this.frames.filter(isVoiced);
    const enough = confidence >= MIN_SPEECH_FRACTION && voicedFrames.length >= 20;
    if (!enough) return { speechSeconds, analyzedSeconds, suspicion: 0, confidence, level: "collecting", metrics: null };
    return { speechSeconds, analyzedSeconds, confidence, ...this.judge(voicedFrames) };
  }

  private judge(voiced: FrameFeatures[]): Pick<VoiceSnapshot, "suspicion" | "level" | "metrics"> {
    const pitchSteps: number[] = [];
    const levelSteps: number[] = [];
    for (let i = 1; i < this.frames.length; i++) {
      const a = this.frames[i - 1]!;
      const b = this.frames[i]!;
      if (!isVoiced(a) || !isVoiced(b)) continue;
      pitchSteps.push(Math.abs(12 * Math.log2(b.f0 / a.f0)));
      levelSteps.push(Math.abs(Math.log(b.rms / a.rms)));
    }
    const fluxes = voiced.map((f) => f.flux).filter((x) => x > 0);
    const fluxMean = mean(fluxes);
    const metrics: VoiceMetrics = {
      flatness: mean(voiced.map((f) => f.flatness)),
      rolloffHz: median(voiced.map((f) => f.rolloffHz)),
      highBandRatio: median(voiced.map((f) => f.highBandRatio)),
      pitchStepSemitones: mean(pitchSteps),
      levelStep: mean(levelSteps),
      fluxVariation: fluxMean > 0 ? std(fluxes) / fluxMean : 0,
    };
    // Each trait runs from 0 (ordinary) to 1 (typical of a synthetic voice). The cutoff trait only
    // applies when the stream is wide enough to hold the high band at all.
    const traits: number[] = [];
    if (this.sampleRate / 2 >= 2 * HIGH_BAND_HZ) traits.push(ramp(Math.log10(metrics.highBandRatio + 1e-9), -3.5, -5.5));
    if (pitchSteps.length >= 15) {
      traits.push(ramp(metrics.pitchStepSemitones, 0.25, 0.05));
      traits.push(ramp(metrics.levelStep, 0.12, 0.03));
    }
    if (fluxes.length >= 15) traits.push(ramp(metrics.fluxVariation, 0.5, 0.2));
    if (!traits.length) return { suspicion: 0, level: "collecting", metrics };
    const suspicion = mean(traits);
    return { suspicion, level: suspicion >= 0.5 ? "some" : "low", metrics };
  }
}
