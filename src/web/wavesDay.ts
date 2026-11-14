import type { BestWindow, TideAtPeak } from '../shared/types.ts';
import { compass } from '../shared/geo.ts';
import { formatNumber, formatTime, localDate } from '../shared/format.ts';
import { starLabel } from '../shared/score.ts';

/** Indices of the hours of local `date`. */
export function dayIndices(time: number[], date: string): number[] {
  const out: number[] = [];
  time.forEach((t, i) => {
    if (localDate(t) === date) out.push(i);
  });
  return out;
}

/** All hours when `showNight`, otherwise daylight hours only. */
export function visibleIndices(indices: number[], isDay: boolean[], showNight: boolean): number[] {
  return showNight ? indices : indices.filter((i) => isDay[i]);
}

/** True when hour `t` lies inside the window. */
export function inWindow(t: number, w: BestWindow | undefined): boolean {
  return !!w && t >= w.start && t < w.end;
}

const TIDE_TEXT: Record<TideAtPeak, string> = {
  high: 'při vrcholu přílivu',
  rising: 'za stoupajícího přílivu',
  falling: 'za klesajícího přílivu',
  low: 'při odlivu',
};

export interface WindowSummary {
  /** Text before the stars. */
  lead: string;
  /** Whole stars of the window; null when there is no window. */
  stars: number | null;
  /** Text after the stars. */
  tail: string;
  detail: string;
}

/** Day summary around the window's stars; 0–1★ says it is not worth going. */
export function windowSummary(w: BestWindow | undefined): WindowSummary {
  if (!w) return { lead: 'Pro tento den chybí data.', stars: null, tail: '', detail: '' };
  const range = `${formatTime(w.start)}–${formatTime(w.end)}`;
  const label = starLabel(w.stars);
  const detail =
    `Swell ${formatNumber(w.swellHeight)} m / ${formatNumber(w.swellPeriod, 0)} s od ${compass(w.swellDir)}, ` +
    `${TIDE_TEXT[w.tideAtPeak]}.`;
  if (w.stars === 0) return { lead: 'Nestojí za to:', stars: 0, tail: `${label} celý den`, detail };
  if (w.stars === 1) return { lead: 'Nestojí za to:', stars: 1, tail: `${label}, nejlépe ${range}`, detail };
  return { lead: `Nejlepší ${range}:`, stars: w.stars, tail: label, detail };
}

/** Largest value of `values` at `indices`; 0 for none. */
export function maxAt(values: number[], indices: number[]): number {
  return indices.reduce((m, i) => Math.max(m, values[i] ?? 0), 0);
}

/** Axis with `divisions` equal steps, each a multiple of `step`, whose top is ≥ max. */
export function alignedAxis(max: number, divisions: number, step: number): { top: number; unit: number } {
  const unit = Math.max(step, Math.ceil(max / divisions / step) * step);
  return { top: unit * divisions, unit };
}
