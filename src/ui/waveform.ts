/** Longest the live waveform is redrawn (about 10 frames per second). */
export const WAVE_REFRESH_MS = 100;
/** With "reduce motion" the waveform only steps once a second instead of flowing. */
export const WAVE_REFRESH_REDUCED_MS = 1000;

/**
 * Turns waveform samples into an SVG path that fills a `width` x `height` box. The signal is
 * centred and scaled by its own peak, so a faint pulse is as readable as a strong one.
 * Returns "" when there is nothing meaningful to draw (fewer than 2 samples, flat or not finite).
 */
export function waveformPath(samples: readonly number[], width: number, height: number, pad = 3): string {
  const n = samples.length;
  if (n < 2 || !(width > 0) || !(height > 0)) return "";
  let peak = 0;
  for (const v of samples) {
    if (!Number.isFinite(v)) return "";
    peak = Math.max(peak, Math.abs(v));
  }
  if (peak < 1e-12) return "";
  const mid = height / 2;
  const amp = Math.max(0, mid - pad);
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * width;
    const y = mid - (samples[i]! / peak) * amp;
    d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}
