import { localDate } from './format.ts';
import { tideStateAt, type TideSeries } from './tide.ts';
import type { BestWindow, CellHourly, TideAtPeak, TideExtreme } from './types.ts';

const HOUR = 3600;
/** Window grows over adjacent daylight hours scoring at least peak minus this. */
const EXTEND_BELOW_PEAK = 0.5;
/** Absorbs float error in one-decimal score differences. */
const EPS = 1e-9;
/** Within this distance of an extreme the tide counts as high/low. */
const SLACK_S = HOUR;

/** 'high'/'low' within 1 h of an extreme, otherwise the trend. */
export function tideAtPeak(series: TideSeries, extremes: TideExtreme[], t: number): TideAtPeak {
  const near = extremes.find((e) => Math.abs(e.time - t) <= SLACK_S);
  if (near) return near.type;
  return tideStateAt(series, extremes, t).trend;
}

export interface WindowInput {
  time: number[];
  isDay: boolean[];
  /** Spot score per hour, parallel to `time`. */
  score: number[];
  hourly: Pick<CellHourly, 'swellHeight' | 'swellPeriod' | 'swellDir' | 'precip' | 'windGust' | 'airTemp'>;
  tide: TideSeries & { extremes: TideExtreme[] };
  /** Local dates (YYYY-MM-DD) to emit a window for. */
  dates: string[];
}

/**
 * One window per date that has daylight: peak = best daylight hour (earliest
 * on ties), extended over adjacent daylight hours of the same date within 0.5
 * of the peak. `end` is the end of the last hour. Comfort values are
 * reported only: total rain, max gust, mean temperature.
 */
export function bestWindows(input: WindowInput): BestWindow[] {
  const { time, isDay, score, hourly, tide, dates } = input;
  const dateOf = time.map(localDate);
  const out: BestWindow[] = [];

  for (const date of dates) {
    let peak = -1;
    for (let i = 0; i < time.length; i++) {
      if (dateOf[i] !== date || !isDay[i]) continue;
      if (peak < 0 || score[i]! > score[peak]! || Number.isNaN(score[peak]!)) peak = i;
    }
    if (peak < 0) continue;

    const min = score[peak]! - EXTEND_BELOW_PEAK - EPS;
    const ok = (i: number) => dateOf[i] === date && isDay[i] === true && score[i]! >= min;
    let lo = peak;
    let hi = peak;
    while (lo > 0 && ok(lo - 1)) lo--;
    while (hi < time.length - 1 && ok(hi + 1)) hi++;

    let rain = 0;
    let gust = 0;
    let temp = 0;
    for (let i = lo; i <= hi; i++) {
      rain += hourly.precip[i]!;
      gust = Math.max(gust, hourly.windGust[i]!);
      temp += hourly.airTemp[i]!;
    }
    const n = hi - lo + 1;
    const peakTime = time[peak]!;
    out.push({
      date,
      start: time[lo]!,
      end: time[hi]! + HOUR,
      stars: Math.round(score[peak]!),
      peakTime,
      swellHeight: hourly.swellHeight[peak]!,
      swellPeriod: hourly.swellPeriod[peak]!,
      swellDir: hourly.swellDir[peak]!,
      tideAtPeak: tideAtPeak(tide, tide.extremes, peakTime),
      comfort: {
        rainMm: Math.round(rain * 10) / 10,
        gustKmh: gust,
        tempC: Math.round((temp / n) * 10) / 10,
      },
    });
  }
  return out;
}
