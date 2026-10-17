import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { FaceTracker, type Box } from "../engine/analyzer";
import { rigidResidual, type Point } from "../engine/geometry";
import type { Assessment, FaceFrame, RGB, Sensitivity } from "../engine/types";
import { FACE_OVAL, FOREHEAD, INNER_FEATURES, LEFT_CHEEK, RIGHT_CHEEK, RIGID, convexHull, headPose, shrink, type P } from "./landmarks";

const CROP = 160;

export interface ScannedFace {
  id: number;
  /** Box in normalized video coordinates (0..1). */
  box: Box;
  /** A few landmarks for the overlay, normalized. */
  points: P[];
  yaw: number;
  assessment: Assessment;
}

export interface ScanResult {
  t: number;
  faces: ScannedFace[];
  /** The part of the video being analyzed (normalized), or null for the whole frame. */
  region: Box | null;
  /** True when Verilive zoomed in by itself because faces were too small to find. */
  autoZoom: boolean;
}

/** Overlapping tiles of a given size covering the frame. */
function tiles(size: number, steps: number): Box[] {
  const out: Box[] = [];
  for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) out.push({ x: (j * (1 - size)) / (steps - 1), y: (i * (1 - size)) / (steps - 1), w: size, h: size });
  return out;
}

/**
 * Tiles searched when no face is found in the whole frame (small faces, gallery view).
 * Searches alternate between a coarse and a fine level to keep each search short.
 */
const SEARCH_LEVELS: Box[][] = [tiles(0.6, 2), tiles(0.4, 3)];

type Source = HTMLVideoElement;

/** Loads the face model and turns video frames into per-person assessments. All on-device. */
export class Scanner {
  readonly tracker = new FaceTracker();
  private landmarker: FaceLandmarker | null = null;
  /** Second model instance in still-image mode, used only to search tiles for small faces. */
  private finder: FaceLandmarker | null = null;
  private work: CanvasRenderingContext2D;
  private regionBox: Box | null = null;
  private autoRegion = false;
  private misses = 0;
  private lastSearch = -Infinity;
  private searchLevel = 0;
  private crop: CanvasRenderingContext2D;
  private mask: CanvasRenderingContext2D;
  private prevRigid = new Map<number, Point[]>();
  private prevCenter = new Map<number, { x: number; y: number; t: number }>();
  private lastTs = -1;
  private t0 = -1;
  private sensitivityValue: Sensitivity = "balanced";
  private checkActive = false;

  constructor() {
    this.crop = makeContext();
    this.mask = makeContext();
    this.work = makeContext();
  }

  async init(maxFaces = 4, onProgress?: (text: string) => void): Promise<void> {
    const base = import.meta.env.BASE_URL;
    onProgress?.("Loading the face model");
    const files = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate },
      runningMode: "VIDEO" as const,
      numFaces: maxFaces,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    // CPU (WebAssembly + SIMD) is fast enough for a few faces at 15 fps and behaves the same on
    // every machine; the GPU path stalls when frames are read back for pixel measurements.
    try {
      this.landmarker = await FaceLandmarker.createFromOptions(files, options("CPU"));
    } catch {
      this.landmarker = await FaceLandmarker.createFromOptions(files, options("GPU"));
    }
    this.finder = await FaceLandmarker.createFromOptions(files, { ...options("CPU"), runningMode: "IMAGE", outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false });
  }

  /** Analyze only part of the video (normalized box), or the whole frame with null. */
  setRegion(region: Box | null, auto = false): void {
    this.regionBox = region;
    this.autoRegion = !!region && auto;
    this.misses = 0;
    this.prevRigid.clear();
    this.prevCenter.clear();
  }

  get region(): Box | null {
    return this.regionBox;
  }

  get sensitivity(): Sensitivity {
    return this.sensitivityValue;
  }

  setSensitivity(s: Sensitivity): void {
    this.sensitivityValue = s;
  }

  /** While a guided check runs, frames are also kept for the head-turn comparison. */
  setCheckActive(active: boolean): void {
    this.checkActive = active;
  }

  get ready(): boolean {
    return !!this.landmarker;
  }

  reset(): void {
    this.tracker.reset();
    this.prevRigid.clear();
    this.prevCenter.clear();
    this.t0 = -1;
    this.regionBox = null;
    this.autoRegion = false;
    this.misses = 0;
    this.lastSearch = -Infinity;
  }

  close(): void {
    this.landmarker?.close();
    this.finder?.close();
    this.landmarker = null;
    this.finder = null;
  }

  /** Draws part of the video into the work canvas, upscaled so small faces become findable. */
  private renderRegion(video: Source, r: Box, targetHeight = 720): HTMLCanvasElement {
    const W = video.videoWidth;
    const H = video.videoHeight;
    const sw = r.w * W;
    const sh = r.h * H;
    const scale = Math.min(targetHeight / sh, 1280 / sw, 4);
    const c = this.work.canvas;
    const cw = Math.max(16, Math.round(sw * scale));
    const ch = Math.max(16, Math.round(sh * scale));
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    this.work.drawImage(video, r.x * W, r.y * H, sw, sh, 0, 0, cw, ch);
    return c;
  }

  /** Looks for small faces tile by tile and zooms in on the largest one. */
  private search(video: Source): void {
    if (!this.finder) return;
    let best: Box | null = null;
    const level = SEARCH_LEVELS[this.searchLevel++ % SEARCH_LEVELS.length]!;
    for (const tile of level) {
      let found: FaceLandmarkerResult;
      try {
        found = this.finder.detect(this.renderRegion(video, tile, 540));
      } catch {
        continue;
      }
      for (const lm of found.faceLandmarks ?? []) {
        const b = boundingBox(lm);
        const box = { x: tile.x + b.x * tile.w, y: tile.y + b.y * tile.h, w: b.w * tile.w, h: b.h * tile.h };
        if (!best || box.w * box.h > best.w * best.h) best = box;
      }
    }
    if (best) this.setRegion(expand(best, video.videoWidth, video.videoHeight), true);
  }

  /** Processes the frame currently shown by `video`. `nowMs` must increase between calls. */
  scan(video: Source, nowMs: number): ScanResult | null {
    if (!this.landmarker || video.readyState < 2 || !video.videoWidth) return null;
    const ts = Math.max(nowMs, this.lastTs + 1);
    this.lastTs = ts;
    if (this.t0 < 0) this.t0 = ts;
    const t = (ts - this.t0) / 1000;

    const region = this.regionBox;
    let result: FaceLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(region ? this.renderRegion(video, region) : video, ts);
    } catch {
      return null;
    }
    const W = video.videoWidth;
    const H = video.videoHeight;
    // Landmarks come back relative to the analyzed area; map them to whole-video coordinates.
    const faces: P[][] = (result.faceLandmarks ?? []).map((lm) =>
      region ? lm.map((p) => ({ x: region.x + p.x * region.w, y: region.y + p.y * region.h })) : lm,
    );

    if (faces.length) this.misses = 0;
    else {
      this.misses++;
      if (this.autoRegion && this.misses > 45) this.setRegion(null);
      else if (!region && this.misses > 20 && ts - this.lastSearch > 1500) {
        this.lastSearch = ts;
        this.search(video);
      }
    }
    const boxes = faces.map((lm) => boundingBox(lm));
    const ids = this.tracker.assign(boxes, t);

    const out: ScannedFace[] = [];
    faces.forEach((lm, i) => {
      const id = ids[i]!;
      const box = boxes[i]!;
      const blend = result.faceBlendshapes?.[i]?.categories ?? [];
      const score = (name: string) => blend.find((c) => c.categoryName === name)?.score ?? 0;
      const pose = headPose(result.facialTransformationMatrixes?.[i]?.data, lm);
      const frame = this.measure(video, lm, box, W, H, t, id);
      frame.blinkLeft = score("eyeBlinkLeft");
      frame.blinkRight = score("eyeBlinkRight");
      frame.yaw = pose.yaw;
      frame.pitch = pose.pitch;
      const analyzer = this.tracker.analyzer(id)!;
      analyzer.push(frame, this.checkActive);
      out.push({
        id,
        box,
        points: RIGID.map((k) => lm[k]!).filter(Boolean),
        yaw: pose.yaw,
        assessment: analyzer.assess(t, this.sensitivityValue),
      });
    });
    return { t, faces: out, region: this.regionBox, autoZoom: this.autoRegion };
  }

  private measure(video: Source, lm: P[], box: Box, W: number, H: number, t: number, id: number): FaceFrame {
    // Square crop around the face, in source pixels.
    const side = Math.max(box.w * W, box.h * H) * 1.08;
    const cx = (box.x + box.w / 2) * W;
    const cy = (box.y + box.h / 2) * H;
    const sx = cx - side / 2;
    const sy = cy - side / 2;
    const toCrop = (p: P): P => ({ x: ((p.x * W - sx) / side) * CROP, y: ((p.y * H - sy) / side) * CROP });

    this.crop.clearRect(0, 0, CROP, CROP);
    this.crop.drawImage(video, sx, sy, side, side, 0, 0, CROP, CROP);
    const px = this.crop.getImageData(0, 0, CROP, CROP).data;

    // Rasterize the regions once into a mask: R = face oval, G = inner face, B = skin patches.
    const m = this.mask;
    m.globalCompositeOperation = "source-over";
    m.fillStyle = "#000";
    m.fillRect(0, 0, CROP, CROP);
    m.globalCompositeOperation = "lighter";
    fillPoly(m, FACE_OVAL.map((k) => toCrop(lm[k]!)), "rgb(255,0,0)");
    fillPoly(m, convexHull(INNER_FEATURES.map((k) => toCrop(lm[k]!))), "rgb(0,255,0)");
    fillPoly(m, shrink(FOREHEAD.map((k) => toCrop(lm[k]!)), 0.8), "rgb(0,0,80)");
    fillPoly(m, shrink(LEFT_CHEEK.map((k) => toCrop(lm[k]!)), 0.8), "rgb(0,0,160)");
    fillPoly(m, shrink(RIGHT_CHEEK.map((k) => toCrop(lm[k]!)), 0.8), "rgb(0,0,240)");
    const mk = m.getImageData(0, 0, CROP, CROP).data;

    const acc = {
      inLap: 0, inN: 0, outLap: 0, outN: 0,
      inRGB: [0, 0, 0], outRGB: [0, 0, 0],
      roi: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] as number[][],
      roiAll: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] as number[][],
    };
    const gray = (i: number) => 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    for (let y = 1; y < CROP - 1; y++) {
      for (let x = 1; x < CROP - 1; x++) {
        const i = (y * CROP + x) * 4;
        const inOval = mk[i]! > 127;
        const inInner = mk[i + 1]! > 127;
        const r = px[i]!;
        const g = px[i + 1]!;
        const b = px[i + 2]!;
        if (inOval) {
          const lap = Math.abs(4 * gray(i) - gray(i - 4) - gray(i + 4) - gray(i - CROP * 4) - gray(i + CROP * 4));
          if (inInner) {
            acc.inLap += lap; acc.inN++;
            acc.inRGB[0]! += r; acc.inRGB[1]! += g; acc.inRGB[2]! += b;
          } else {
            acc.outLap += lap; acc.outN++;
            acc.outRGB[0]! += r; acc.outRGB[1]! += g; acc.outRGB[2]! += b;
          }
        }
        const blue = mk[i + 2]!;
        if (blue > 40) {
          const k = blue < 120 ? 0 : blue < 200 ? 1 : 2;
          const all = acc.roiAll[k]!;
          all[0]! += r; all[1]! += g; all[2]! += b; all[3]!++;
          if (isSkin(r, g, b)) {
            const s = acc.roi[k]!;
            s[0]! += r; s[1]! += g; s[2]! += b; s[3]!++;
          }
        }
      }
    }
    const roiMean = (k: number): RGB | null => {
      const s = acc.roi[k]!;
      const a = acc.roiAll[k]!;
      const use = s[3]! >= 25 ? s : a[3]! >= 25 ? a : null;
      return use ? [use[0]! / use[3]!, use[1]! / use[3]!, use[2]! / use[3]!] : null;
    };
    const chroma = (c: number[], n: number): [number, number] => {
      const sum = c[0]! + c[1]! + c[2]!;
      return n && sum ? [c[0]! / sum, c[1]! / sum] : [1 / 3, 1 / 3];
    };

    // Shape wobble after removing head movement (in pixel units so aspect ratio is right).
    const rigid: Point[] = RIGID.map((k) => [lm[k]!.x * W, lm[k]!.y * H]);
    const prev = this.prevRigid.get(id);
    const jitter = prev ? rigidResidual(prev, rigid) : 0;
    this.prevRigid.set(id, rigid);

    const center = { x: (box.x + box.w / 2) * W, y: (box.y + box.h / 2) * H, t };
    const pc = this.prevCenter.get(id);
    const faceWidthPx = box.w * W;
    const motion = pc && t - pc.t < 0.5 ? Math.hypot(center.x - pc.x, center.y - pc.y) / Math.max(faceWidthPx, 1) : 0;
    this.prevCenter.set(id, center);

    return {
      t,
      forehead: roiMean(0),
      leftCheek: roiMean(1),
      rightCheek: roiMean(2),
      blinkLeft: 0,
      blinkRight: 0,
      yaw: 0,
      pitch: 0,
      innerSharpness: acc.inN ? acc.inLap / acc.inN : 0,
      outerSharpness: acc.outN ? acc.outLap / acc.outN : 0,
      innerChroma: chroma(acc.inRGB, acc.inN),
      outerChroma: chroma(acc.outRGB, acc.outN),
      jitter,
      faceWidthPx,
      motion,
    };
  }
}

function boundingBox(lm: P[]): Box {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of lm) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** Grows a face box into a square analysis area about 3x the face size, clamped to the frame. */
export function expand(b: Box, W: number, H: number): Box {
  const side = 3 * Math.max(b.w * W, b.h * H);
  const w = Math.min(1, side / W);
  const h = Math.min(1, side / H);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return { x: Math.min(Math.max(0, cx - w / 2), 1 - w), y: Math.min(Math.max(0, cy - h / 2), 1 - h), w, h };
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: P[], color: string): void {
  if (pts.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
}

/** Broad skin-tone test in YCbCr that works across skin tones. */
function isSkin(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cr > 130 && cr < 180 && cb > 75 && cb < 130;
}

function makeContext(): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = CROP;
  c.height = CROP;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available in this browser.");
  ctx.imageSmoothingEnabled = true;
  return ctx;
}
