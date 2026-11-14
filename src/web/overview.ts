import type { BestWindow, DayInfo, TideAtPeak, TideExtreme } from '../shared/types.ts';
import { formatNumber, formatTime, localDate, localHour, relativeDay, formatWeekdayDate } from '../shared/format.ts';
import { dayIndices, maxAt } from './wavesDay.ts';

const HOUR = 3600;
/** Number of local dates (today included) searched for the best window. */
export const UPCOMING_DAYS = 3;
/** Minimum stars for a window to be worth recommending. */
export const MIN_WORTH_STARS = 2;
/** A high tide this close to a window (s) is named as its tide. */
const TIDE_NEAR_S = HOUR;

/** Index of the hour containing `now`, or -1 when outside the series. */
export function hourIndexAt(time: number[], now: number): number {
  return time.findIndex((t) => now >= t && now < t + HOUR);
}

/** Local dates from today on, at most `count`. */
export function upcomingDates(days: DayInfo[], now: number, count = UPCOMING_DAYS): string[] {
  const today = localDate(now);
  return days
    .map((d) => d.date)
    .filter((d) => d >= today)
    .slice(0, count);
}

/** Highest-star window within the upcoming dates that has not ended; earliest on ties. */
export function bestUpcoming(windows: BestWindow[], days: DayInfo[], now: number): BestWindow | null {
  const dates = upcomingDates(days, now);
  let best: BestWindow | null = null;
  for (const w of windows) {
    if (!dates.includes(w.date) || w.end <= now) continue;
    if (!best || w.stars > best.stars || (w.stars === best.stars && w.start < best.start)) best = w;
  }
  return best;
}

/** Window shown as a recommendation: reaches the minimum stars. */
export function isWorthGoing(w: BestWindow | null): w is BestWindow {
  return !!w && w.stars >= MIN_WORTH_STARS;
}

/** `14–17 h` (local hours; the end is the end of the last hour). */
export function windowHours(w: BestWindow): string {
  return `${localHour(w.start)}–${localHour(w.end - 1) + 1}\u00a0h`;
}

const TIDE_TEXT: Record<TideAtPeak, string> = {
  high: 'vrchol přílivu',
  rising: 'příliv stoupá',
  falling: 'příliv klesá',
  low: 'odliv',
};

/** `příliv 16:40` for a high tide within 1 h of the window, otherwise the tide state at its peak. */
export function windowTideText(w: BestWindow, extremes: TideExtreme[]): string {
  const high = extremes.find((e) => e.type === 'high' && e.time >= w.start - TIDE_NEAR_S && e.time <= w.end + TIDE_NEAR_S);
  return high ? `příliv ${formatTime(high.time)}` : TIDE_TEXT[w.tideAtPeak];
}

/**
 * Largest wave height over daylight hours of the upcoming dates, from the
 * current hour on.
 */
export function upcomingMaxWave(time: number[], isDay: boolean[], waveHeight: number[], days: DayInfo[], now: number): number {
  const idx: number[] = [];
  for (const date of upcomingDates(days, now)) {
    for (const i of dayIndices(time, date)) {
      if (isDay[i] && time[i]! + HOUR > now) idx.push(i);
    }
  }
  return maxAt(waveHeight, idx);
}

export interface OutlookItem {
  date: string;
  /** `dnes`, `zítra` or the short weekday. */
  top: string;
  /** `14. 11.` */
  bottom: string;
  stars: number | null;
  /** Largest daylight swell height (m), null without data. */
  maxSwell: number | null;
  label: string;
}

/** One item per forecast day: window stars and the largest daylight swell. */
export function outlookItems(
  days: DayInfo[],
  windows: BestWindow[],
  time: number[],
  isDay: boolean[],
  swellHeight: number[],
  now: number,
): OutlookItem[] {
  return days.map((d) => {
    const w = windows.find((x) => x.date === d.date);
    const daylight = dayIndices(time, d.date).filter((i) => isDay[i]);
    const maxSwell = daylight.length ? maxAt(swellHeight, daylight) : null;
    const [wd = '', ...rest] = formatWeekdayDate(d.sunrise).split(' ');
    const bottom = rest.join(' ');
    const top = relativeDay(d.sunrise, now) ?? wd;
    return {
      date: d.date,
      top,
      bottom,
      stars: w ? w.stars : null,
      maxSwell,
      label: `${top} ${bottom}`,
    };
  });
}

/** `3,2 m` or an en dash. */
export function swellText(m: number | null): string {
  return m === null ? '–' : `${formatNumber(m)}\u00a0m`;
}
