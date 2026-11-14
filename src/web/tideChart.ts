import type { DayInfo, TideExtreme } from '../shared/types.ts';
import { localDate, localHour } from '../shared/format.ts';
import type { TideSeries } from '../shared/tide.ts';

/** Linear map from a domain to a range. */
export function linearScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * k;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** SVG path `M x y L x y …` through the points. */
export function linePath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}`).join('');
}

/** Closed path under the line down to `baseY`. */
export function areaPath(points: [number, number][], baseY: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `${linePath(points)}L${r1(last[0])} ${r1(baseY)}L${r1(first[0])} ${r1(baseY)}Z`;
}

/** Whole-step tick values covering [min, max]. */
export function yTicks(min: number, max: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/** Night intervals (sunset → next sunrise) clipped to [t0, t1]. */
export function nightBands(days: DayInfo[], t0: number, t1: number): [number, number][] {
  const sorted = [...days].sort((a, b) => a.sunrise - b.sunrise);
  const raw: [number, number][] = [];
  let prevEnd = -Infinity;
  for (const d of sorted) {
    raw.push([prevEnd, d.sunrise]);
    prevEnd = d.sunset;
  }
  raw.push([prevEnd, Infinity]);
  const out: [number, number][] = [];
  for (const [a, b] of raw) {
    const s = Math.max(a, t0);
    const e = Math.min(b, t1);
    if (e > s) out.push([s, e]);
  }
  return out;
}

/** Times in [t0, t1] on full local hours whose hour is a multiple of `everyH`. */
export function hourTicks(t0: number, t1: number, everyH = 6): { t: number; hour: number }[] {
  const out: { t: number; hour: number }[] = [];
  for (let t = Math.ceil(t0 / 3600) * 3600; t <= t1; t += 3600) {
    const hour = localHour(t);
    if (hour % everyH === 0) out.push({ t, hour });
  }
  return out;
}

/** Chart window: `hours` long from the first full hour of `date` in the series (local midnight unless the series starts later that day), clamped to the series end. */
export function chartWindow(series: TideSeries, date: string, hours = 36): { t0: number; t1: number } {
  const end = series.start + (series.levelMsl.length - 1) * series.step;
  let t0 = series.start;
  for (let t = series.start; t <= end; t += 3600) {
    if (localDate(t) === date) {
      t0 = t;
      break;
    }
  }
  return { t0, t1: Math.min(end, t0 + hours * 3600) };
}

/** Samples of the series inside [t0, t1] as [time, display height]. */
export function seriesPoints(series: TideSeries, t0: number, t1: number, offset: number): [number, number][] {
  const out: [number, number][] = [];
  series.levelMsl.forEach((v, i) => {
    const t = series.start + i * series.step;
    if (t >= t0 && t <= t1) out.push([t, v + offset]);
  });
  return out;
}

/** Extremes inside [t0, t1]. */
export function extremesIn(extremes: TideExtreme[], t0: number, t1: number): TideExtreme[] {
  return extremes.filter((e) => e.time >= t0 && e.time <= t1);
}

/** Extremes grouped by Europe/Madrid date, in time order. */
export function groupByDate(extremes: TideExtreme[]): Map<string, TideExtreme[]> {
  const m = new Map<string, TideExtreme[]>();
  for (const e of extremes) {
    const d = localDate(e.time);
    const list = m.get(d);
    if (list) list.push(e);
    else m.set(d, [e]);
  }
  return m;
}
