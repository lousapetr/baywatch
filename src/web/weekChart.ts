import type { BestWindow, SpotForecast } from '../shared/types.ts';
import { localDate } from '../shared/format.ts';

export interface DaySpan {
  date: string;
  /** First hour start. */
  start: number;
  /** End of the last hour. */
  end: number;
}

/** Consecutive hours of the same local date, in order. */
export function daySpans(time: number[]): DaySpan[] {
  const out: DaySpan[] = [];
  for (const t of time) {
    const date = localDate(t);
    const last = out[out.length - 1];
    if (last && last.date === date) last.end = t + 3600;
    else out.push({ date, start: t, end: t + 3600 });
  }
  return out;
}

export interface DashboardRow {
  id: string;
  name: string;
  win: BestWindow | undefined;
}

/** One row per spot with its best window on `date`. */
export function dashboardRows(spots: SpotForecast[], date: string): DashboardRow[] {
  return spots.map((s) => ({ id: s.id, name: s.name, win: s.windows.find((w) => w.date === date) }));
}

/** Axis from a whole-number `lo` in `divisions` equal whole-number steps covering [min, max]. */
export function tempAxis(min: number, max: number, divisions: number): { lo: number; unit: number; top: number } {
  const lo = Math.floor(min);
  const unit = Math.max(1, Math.ceil((max - lo) / divisions));
  return { lo, unit, top: lo + unit * divisions };
}
