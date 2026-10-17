/** MediaPipe Face Mesh landmark indices used by the measurements. */

/** Outline of the face from forehead around the jaw. */
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/** Eyes, brows, nose and mouth: the area a face swap replaces. Its convex hull is the "inner face". */
export const INNER_FEATURES = [33, 133, 159, 145, 362, 263, 386, 374, 70, 105, 107, 336, 334, 300, 1, 4, 98, 327, 168, 61, 291, 0, 17, 13, 14];

/** Skin patches for the pulse signal (shrunk towards their centre before use). */
export const FOREHEAD = [109, 10, 338, 336, 9, 107];
export const LEFT_CHEEK = [123, 117, 118, 101, 36, 205, 187];
export const RIGHT_CHEEK = [352, 346, 347, 330, 266, 425, 411];

/** Points on the skull that barely move with expressions; used to measure shape wobble. */
export const RIGID = [33, 133, 362, 263, 168, 6, 1, 152, 10, 234, 454];

/** Small subset drawn on the preview so people can see what is tracked. */
export const OVERLAY_POINTS = [...RIGID, 61, 291, 0, 17, 159, 145, 386, 374];

export type P = { x: number; y: number };

export function convexHull(points: P[]): P[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: P[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function shrink(poly: P[], factor: number): P[] {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  return poly.map((p) => ({ x: cx + (p.x - cx) * factor, y: cy + (p.y - cy) * factor }));
}

/**
 * Head yaw and pitch in degrees from MediaPipe's 4x4 facial transformation matrix
 * (column-major). Falls back to a landmark estimate when no matrix is available.
 */
export function headPose(matrix: ArrayLike<number> | undefined, lm: P[]): { yaw: number; pitch: number } {
  if (matrix && matrix.length >= 16) {
    const r = (row: number, col: number) => matrix[col * 4 + row]!;
    const yaw = Math.atan2(-r(2, 0), Math.hypot(r(0, 0), r(1, 0)));
    const pitch = Math.atan2(r(2, 1), r(2, 2));
    return { yaw: (yaw * 180) / Math.PI, pitch: (pitch * 180) / Math.PI };
  }
  const nose = lm[1];
  const l = lm[234];
  const rr = lm[454];
  if (!nose || !l || !rr) return { yaw: 0, pitch: 0 };
  const half = Math.abs(rr.x - l.x) / 2 || 1;
  const offset = (nose.x - (l.x + rr.x) / 2) / half;
  return { yaw: Math.max(-90, Math.min(90, offset * 70)), pitch: 0 };
}
