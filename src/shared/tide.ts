import { localDate } from './format.ts';
import type { TideDay, TideExtreme } from './types.ts';

export interface TideSeries {
  start: number;
  step: number;
  levelMsl: number[];
}

export interface TideState {
  level: number;
  trend: 'rising' | 'falling';
  prev: TideExtreme | null;
  next: TideExtreme | null;
  /** Progress between `prev` and `next` (0–1); null when either is missing. */
  fraction: number | null;
}

/** Extremes closer than this to the previous kept one are treated as noise. */
const MIN_SPACING_S = 3 * 3600;
/** Samples at each end of the series that cannot hold a confirmed extreme. */
const EDGE_SAMPLES = 2;

/**
 * Local extremes of the series: sign change of the first difference, time and
 * height refined with a parabola through the three samples around it. An
 * extreme within 3 h of the previous kept one is dropped; of two consecutive
 * same-type extremes the more extreme one is kept, so types alternate.
 */
export function findExtremes(series: TideSeries): TideExtreme[] {
  const { start, step, levelMsl: y } = series;
  const out: TideExtreme[] = [];
  for (let i = Math.max(1, EDGE_SAMPLES); i <= y.length - 1 - EDGE_SAMPLES; i++) {
    const a = y[i - 1]!;
    const b = y[i]!;
    const c = y[i + 1]!;
    const type = a < b && b >= c ? 'high' : a > b && b <= c ? 'low' : null;
    if (!type) continue;
    const denom = a - 2 * b + c;
    const offset = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
    const level = b - 0.25 * (a - c) * offset;
    const time = start + (i + offset) * step;
    const e: TideExtreme = { time: Math.round(time), levelMsl: level, type };
    const last = out[out.length - 1];
    if (last && last.type === type) {
      if (type === 'high' ? level > last.levelMsl : level < last.levelMsl) out[out.length - 1] = e;
      continue;
    }
    if (last && time - last.time < MIN_SPACING_S) continue;
    out.push(e);
  }
  return out;
}

/** Linearly interpolated level; `t` is clamped to the series range. */
export function levelAt(series: TideSeries, t: number): number {
  const { start, step, levelMsl } = series;
  const pos = Math.min(levelMsl.length - 1, Math.max(0, (t - start) / step));
  const i = Math.min(levelMsl.length - 2, Math.floor(pos));
  const a = levelMsl[Math.max(0, i)]!;
  const b = levelMsl[Math.max(0, i) + 1] ?? a;
  return a + (b - a) * (pos - Math.max(0, i));
}

/** Level, trend and position between the surrounding extremes at time `t`. */
export function tideStateAt(series: TideSeries, extremes: TideExtreme[], t: number): TideState {
  let prev: TideExtreme | null = null;
  let next: TideExtreme | null = null;
  for (const e of extremes) {
    if (e.time <= t) prev = e;
    else {
      next = e;
      break;
    }
  }
  let trend: TideState['trend'];
  if (next) trend = next.type === 'high' ? 'rising' : 'falling';
  else if (prev) trend = prev.type === 'high' ? 'falling' : 'rising';
  else trend = levelAt(series, t + series.step) >= levelAt(series, t) ? 'rising' : 'falling';
  const fraction = prev && next ? (t - prev.time) / (next.time - prev.time) : null;
  return { level: levelAt(series, t), trend, prev, next, fraction };
}

/** Level normalised to 0–1 between the lowest and highest level of the series. */
export function tideNorm(series: TideSeries, t: number): number {
  let min = Infinity;
  let max = -Infinity;
  for (const v of series.levelMsl) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(max > min)) return 0.5;
  return (levelAt(series, t) - min) / (max - min);
}

/**
 * Range per Europe/Madrid date: highest high minus lowest low. Dates without
 * both a high and a low (e.g. the partial last day) are omitted.
 */
export function dailyRanges(extremes: TideExtreme[]): TideDay[] {
  const byDate = new Map<string, { hi: number; lo: number }>();
  for (const x of extremes) {
    const date = localDate(x.time);
    let e = byDate.get(date);
    if (!e) {
      e = { hi: -Infinity, lo: Infinity };
      byDate.set(date, e);
    }
    if (x.type === 'high') e.hi = Math.max(e.hi, x.levelMsl);
    else e.lo = Math.min(e.lo, x.levelMsl);
  }
  return [...byDate.entries()]
    .filter(([, e]) => Number.isFinite(e.hi) && Number.isFinite(e.lo))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, e]) => ({ date, rangeM: Math.round((e.hi - e.lo) * 100) / 100 }));
}
