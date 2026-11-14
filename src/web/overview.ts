import type { BestWindow, DayInfo, Forecast, TideAtPeak, TideExtreme } from '../shared/types.ts';
import { formatTime, localDate, localHour, relativeDay, formatWeekdayDate } from '../shared/format.ts';
import { needsSafetyWarning } from '../shared/safety.ts';
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

/** Days in the Přehled outlook strip (today included). */
export const OUTLOOK_DAYS = 7;

export interface OutlookItem {
  date: string;
  /** `dnes`, `zítra` or the short weekday. */
  top: string;
  stars: number | null;
  /** `zítra 15. 11.` */
  label: string;
}

/** Window stars of each forecast day from today on, at most `OUTLOOK_DAYS`. */
export function outlookItems(days: DayInfo[], windows: BestWindow[], now: number): OutlookItem[] {
  const dates = upcomingDates(days, now, OUTLOOK_DAYS);
  return days
    .filter((d) => dates.includes(d.date))
    .map((d) => {
      const [wd = '', ...rest] = formatWeekdayDate(d.sunrise).split(' ');
      const top = relativeDay(d.sunrise, now) ?? wd;
      const w = windows.find((x) => x.date === d.date);
      return { date: d.date, top, stars: w ? w.stars : null, label: `${top} ${rest.join(' ')}` };
    });
}

/** Earliest date with the most stars, null when no day reaches `MIN_WORTH_STARS`. */
export function bestOutlookDate(items: OutlookItem[]): string | null {
  let best: OutlookItem | null = null;
  for (const o of items) if (o.stars !== null && o.stars > (best?.stars ?? MIN_WORTH_STARS - 1)) best = o;
  return best?.date ?? null;
}

export interface SpotSummary {
  id: string;
  name: string;
  /** Stars of the current hour, null outside the series. */
  nowStars: number | null;
  /** Swell of the current hour, null outside the series. */
  nowSwell: { height: number; period: number; dir: number } | null;
  /** Best upcoming window when it is worth going, else null. */
  best: BestWindow | null;
  /** Largest daylight wave height over the upcoming dates (m). */
  maxWave: number;
  outlook: OutlookItem[];
  /** Day to open in Vlny: the best window's day, else the best outlook day worth going, else today. */
  targetDate: string;
}

/** Everything the Přehled spot card shows; null when the forecast lacks the spot's data. */
export function summarizeSpot(forecast: Forecast, spotId: string, now: number): SpotSummary | null {
  const sf = forecast.spots.find((s) => s.id === spotId);
  const cell = sf && forecast.cells.find((c) => c.id === sf.cell);
  if (!sf || !cell) return null;
  const h = cell.hourly;
  const i = hourIndexAt(forecast.time, now);
  const top = bestUpcoming(sf.windows, forecast.days, now);
  const best = isWorthGoing(top) ? top : null;
  const outlook = outlookItems(forecast.days, sf.windows, now);
  return {
    id: sf.id,
    name: sf.name,
    nowStars: i < 0 ? null : sf.score[i]!,
    nowSwell: i < 0 ? null : { height: h.swellHeight[i]!, period: h.swellPeriod[i]!, dir: h.swellDir[i]! },
    best,
    maxWave: upcomingMaxWave(forecast.time, forecast.isDay, h.waveHeight, forecast.days, now),
    outlook,
    targetDate: best?.date ?? bestOutlookDate(outlook) ?? localDate(now),
  };
}

/** True when any spot's upcoming window or wave height calls for the safety banner. */
export function anySafetyWarning(summaries: SpotSummary[]): boolean {
  return summaries.some((s) => needsSafetyWarning(s.best?.stars ?? 0, s.maxWave));
}
