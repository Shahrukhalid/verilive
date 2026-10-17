import { analyzeFlicker, analyzeTexture } from "./appearance";
import { analyzeBlink } from "./blink";
import { analyzeJitter, analyzePose } from "./geometry";
import { analyzePulse } from "./pulse";
import { combine } from "./scoring";
import type { Assessment, FaceFrame, Sensitivity } from "./types";

/** Seconds of history kept per person. Long enough for pulse and blink statistics. */
export const WINDOW_SECONDS = 60;

export interface TimelinePoint {
  t: number;
  score: number;
  confidence: number;
}

/** Collects frames for one person and turns them into an assessment. */
export class FaceAnalyzer {
  readonly frames: FaceFrame[] = [];
  readonly timeline: TimelinePoint[] = [];
  /** Frames recorded during guided checks, kept beyond the rolling window. */
  readonly checkFrames: FaceFrame[] = [];
  private last: Assessment | null = null;
  private lastEval = -Infinity;

  push(frame: FaceFrame, inCheck = false): void {
    this.frames.push(frame);
    if (inCheck) this.checkFrames.push(frame);
    const cutoff = frame.t - WINDOW_SECONDS;
    let drop = 0;
    while (drop < this.frames.length && this.frames[drop]!.t < cutoff) drop++;
    if (drop) this.frames.splice(0, drop);
    if (this.checkFrames.length > 3000) this.checkFrames.splice(0, this.checkFrames.length - 3000);
  }

  /** Re-evaluates at most once per `every` seconds (the signals are not cheap). */
  assess(now: number, sensitivity: Sensitivity, every = 1): Assessment {
    if (this.last && now - this.lastEval < every) return this.last;
    this.lastEval = now;
    const f = this.frames;
    // The guided head-turn check is kept beyond the rolling window, so its result never expires.
    const poseFrames = this.checkFrames.length ? mergeByTime(this.checkFrames, f) : f;
    const result = combine(
      [analyzePulse(f), analyzePose(poseFrames), analyzeTexture(f), analyzeBlink(f), analyzeFlicker(f), analyzeJitter(f)],
      sensitivity,
    );
    this.last = result;
    if (result.level !== "collecting") this.timeline.push({ t: now, score: result.score, confidence: result.confidence });
    if (this.timeline.length > 1800) this.timeline.splice(0, this.timeline.length - 1800);
    return result;
  }

  get latest(): Assessment | null {
    return this.last;
  }

  /** Frees the per-frame history once a person has left for good. */
  release(): void {
    this.frames.length = 0;
    this.checkFrames.length = 0;
  }
}

/** Merges two time-ordered frame lists, dropping duplicates (frames recorded in both). */
export function mergeByTime(a: FaceFrame[], b: FaceFrame[]): FaceFrame[] {
  const all = [...a, ...b].sort((x, y) => x.t - y.t);
  return all.filter((f, i) => i === 0 || f.t !== all[i - 1]!.t);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Track {
  id: number;
  box: Box;
  lastSeen: number;
  analyzer: FaceAnalyzer;
}

/**
 * Keeps the same person number for the same face from frame to frame (gallery views show
 * several people at once). Matching is by overlap with the previous position.
 */
export class FaceTracker {
  private tracks: Track[] = [];
  /** People no longer on screen; kept so the session report includes them. */
  private retired: Track[] = [];
  private nextId = 1;

  /** A person who is out of view for up to `forgetAfter` seconds keeps the same number and history. */
  constructor(private readonly forgetAfter = 20) {}

  /** Returns the track id for each box, in the same order. */
  assign(boxes: Box[], t: number): number[] {
    const used = new Set<number>();
    const ids = boxes.map((b) => {
      let best: Track | null = null;
      let bestIou = 0.15;
      for (const tr of this.tracks) {
        if (used.has(tr.id)) continue;
        const v = iou(tr.box, b);
        if (v > bestIou) {
          bestIou = v;
          best = tr;
        }
      }
      if (!best) {
        best = { id: this.nextId++, box: b, lastSeen: t, analyzer: new FaceAnalyzer() };
        this.tracks.push(best);
      }
      best.box = b;
      best.lastSeen = t;
      used.add(best.id);
      return best.id;
    });
    const keep = (tr: Track) => t - tr.lastSeen <= this.forgetAfter || used.has(tr.id);
    for (const tr of this.tracks.filter((x) => !keep(x))) {
      tr.analyzer.release(); // keep the verdict and timeline for the report, drop the raw frames
      this.retired.push(tr);
    }
    if (this.retired.length > 50) this.retired.splice(0, this.retired.length - 50);
    this.tracks = this.tracks.filter(keep);
    return ids;
  }

  analyzer(id: number): FaceAnalyzer | undefined {
    return [...this.tracks, ...this.retired].find((t) => t.id === id)?.analyzer;
  }

  /** People seen recently, oldest first. */
  active(t: number, within = 1.5): { id: number; box: Box; analyzer: FaceAnalyzer }[] {
    return this.tracks.filter((tr) => t - tr.lastSeen <= within).map(({ id, box, analyzer }) => ({ id, box, analyzer }));
  }

  all(): { id: number; analyzer: FaceAnalyzer }[] {
    return [...this.retired, ...this.tracks].sort((a, b) => a.id - b.id).map(({ id, analyzer }) => ({ id, analyzer }));
  }

  reset(): void {
    this.tracks = [];
    this.retired = [];
    this.nextId = 1;
  }
}

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}
