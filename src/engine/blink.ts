import { clamp, mean, ramp, round, std } from "./dsp";
import type { FaceFrame, SignalResult } from "./types";

const CLOSE = 0.5;
const OPEN = 0.3;

export interface BlinkStats {
  count: number;
  perMinute: number;
  /** Coefficient of variation of the gaps between blinks (0 = perfectly regular). */
  regularity: number;
  /** Share of frames where one eye is closed and the other wide open (not a normal blink). */
  asymmetry: number;
  duration: number;
}

export function blinkStats(frames: FaceFrame[]): BlinkStats {
  const starts: number[] = [];
  let closed = false;
  let asym = 0;
  for (const f of frames) {
    const both = Math.min(f.blinkLeft, f.blinkRight);
    if (!closed && both >= CLOSE) {
      closed = true;
      starts.push(f.t);
    } else if (closed && Math.max(f.blinkLeft, f.blinkRight) < OPEN) {
      closed = false;
    }
    if (Math.abs(f.blinkLeft - f.blinkRight) > 0.55) asym++;
  }
  const duration = frames.length > 1 ? frames[frames.length - 1]!.t - frames[0]!.t : 0;
  const gaps = starts.slice(1).map((t, i) => t - starts[i]!);
  return {
    count: starts.length,
    perMinute: duration > 0 ? (starts.length * 60) / duration : 0,
    regularity: gaps.length >= 3 && mean(gaps) > 0 ? std(gaps) / mean(gaps) : 1,
    asymmetry: frames.length ? asym / frames.length : 0,
    duration,
  };
}

/**
 * People blink roughly 8 to 25 times a minute, at irregular intervals, with both eyes.
 * Many generated faces blink rarely, too often, on a metronome, or with one eye.
 */
export function analyzeBlink(frames: FaceFrame[]): SignalResult {
  const s = blinkStats(frames);
  const base = { id: "blink" as const, label: "Blinking" };
  const metrics = { count: s.count, perMinute: round(s.perMinute, 1), regularity: round(s.regularity), asymmetry: round(s.asymmetry), duration: round(s.duration, 1) };
  if (s.duration < 15) {
    return { ...base, suspicion: 0, confidence: 0, detail: "Watching blinks for a little longer.", metrics };
  }
  const none = s.count === 0 ? ramp(s.duration, 25, 60) : 0;
  const tooMany = ramp(s.perMinute, 45, 70);
  const metronome = s.count >= 5 ? ramp(s.regularity, 0.18, 0.06) : 0;
  const oneEyed = ramp(s.asymmetry, 0.08, 0.25);
  const suspicion = clamp(Math.max(none * 0.8, tooMany * 0.6, metronome * 0.75, oneEyed * 0.7));
  const confidence = clamp(ramp(s.duration, 15, 60) * 0.8);
  let detail =
    s.count === 0
      ? `No blinks yet in ${Math.round(s.duration)} seconds, which is still within the normal range.`
      : `${s.count} natural-looking blink${s.count === 1 ? "" : "s"} (${Math.round(s.perMinute)} per minute).`;
  if (none > 0.3) detail = `No blinks in ${Math.round(s.duration)} seconds. People usually blink every few seconds.`;
  else if (metronome > 0.5) detail = "Blinks happen at suspiciously regular intervals.";
  else if (oneEyed > 0.5) detail = "The eyes often close separately, which is unusual for real blinks.";
  else if (tooMany > 0.5) detail = `Very frequent blinking (${Math.round(s.perMinute)} per minute).`;
  return { ...base, suspicion, confidence, detail, metrics };
}
