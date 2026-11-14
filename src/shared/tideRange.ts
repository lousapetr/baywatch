export type RangeClass = 'large' | 'medium' | 'small';

/** Windows whose ranges differ by less than this (m) are all "medium". */
const MIN_SPREAD_M = 0.3;
const LARGE_FROM = 0.7;
const SMALL_UNTIL = 0.3;

/** Classifies a daily range by its relative position (0–1) within all ranges of the window. */
export function classifyRange(rangeM: number, allRanges: number[]): RangeClass {
  if (allRanges.length === 0) return 'medium';
  const min = Math.min(...allRanges);
  const max = Math.max(...allRanges);
  if (max - min < MIN_SPREAD_M) return 'medium';
  const rel = (rangeM - min) / (max - min);
  if (rel >= LARGE_FROM) return 'large';
  if (rel <= SMALL_UNTIL) return 'small';
  return 'medium';
}

export const RANGE_LABELS: Record<RangeClass, string> = {
  large: 'velký rozsah (skočný příliv)',
  medium: 'střední rozsah',
  small: 'malý rozsah (hluchý)',
};
