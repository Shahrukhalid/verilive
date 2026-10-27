export type Label = "real" | "fake";
export interface PersonLike {
  level: string;
  score: number;
  signals: { id: string; suspicion: number; confidence: number }[];
}
export interface VideoLike {
  label: Label;
  people?: PersonLike[];
}
export interface Summary {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  evaluated: number;
  unrated: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  specificity: number | null;
  f1: number | null;
}
export const LEVEL_RANK: Record<string, number>;
export function normalizeLabel(raw: unknown): Label | null;
export function parseCsvLine(line: string): string[];
export function parseLabelsCsv(text: string): { rows: { path: string; label: Label }[]; errors: string[] };
export function classify(people: PersonLike[] | undefined, threshold?: string): { predicted: Label | null; worstLevel: string; score: number | null };
export function summarize(rows: { label: Label; predicted: Label | null }[]): Summary;
export function signalStats(
  videos: VideoLike[],
  options?: { flagAt?: number; minConfidence?: number },
): { signal: string; measured: number; coverage: number | null; meanSuspicionReal: number | null; meanSuspicionFake: number | null; precision: number | null; recall: number | null; accuracy: number | null }[];
