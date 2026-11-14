import type { CellHourly, DayInfo } from '../shared/types.ts';
import { dayIndices } from './wavesDay.ts';

/** Hours of a precipitation/fog code needed to outrank plain cloud cover. */
const MIN_HOURS = 2;
/** Codes below this are plain sky cover (clear to overcast). */
const FIRST_PHENOMENON = 45;

/**
 * Representative WMO code of a set of hours: the most severe fog/precipitation/storm
 * code seen in at least 2 hours; otherwise the most frequent sky-cover code
 * (ties go to the cloudier one). A single stray hour of drizzle does not count.
 */
export function dominantCode(codes: number[]): number {
  if (codes.length === 0) return 0;
  const count = new Map<number, number>();
  for (const c of codes) count.set(c, (count.get(c) ?? 0) + 1);
  const need = Math.min(MIN_HOURS, codes.length);
  const severe = [...count].filter(([c, n]) => c >= FIRST_PHENOMENON && n >= need).map(([c]) => c);
  if (severe.length > 0) return Math.max(...severe);
  let best = -1;
  let bestN = 0;
  for (const [c, n] of count) {
    if (n > bestN || (n === bestN && c > best)) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

export interface DayWeather {
  date: string;
  sunrise: number;
  sunset: number;
  code: number;
  tempMin: number;
  tempMax: number;
  rainMm: number;
  /** Max rain probability, null when the model gives none. */
  rainProb: number | null;
  windMax: number;
  gustMax: number;
  /** ° coming from, at the hour of the strongest gust. */
  gustDir: number;
  /** Mean daytime sea temperature, null when unavailable. */
  seaTemp: number | null;
}

/** Weather of each day; the code comes from daylight hours (all hours if the sun never rises). */
export function dayWeather(time: number[], isDay: boolean[], h: CellHourly, days: DayInfo[]): DayWeather[] {
  const out: DayWeather[] = [];
  for (const d of days) {
    const all = dayIndices(time, d.date);
    if (all.length === 0) continue;
    const daylight = all.filter((i) => isDay[i]);
    const part = daylight.length > 0 ? daylight : all;
    const temps = all.map((i) => h.airTemp[i]!);
    const probs = all.map((i) => h.precipProb[i]).filter((p): p is number => p !== null && p !== undefined);
    const sea = part.map((i) => h.seaTemp[i]).filter((s): s is number => s !== null && s !== undefined);
    let gi = all[0]!;
    for (const i of all) if (h.windGust[i]! > h.windGust[gi]!) gi = i;
    out.push({
      date: d.date,
      sunrise: d.sunrise,
      sunset: d.sunset,
      code: dominantCode(part.map((i) => h.weatherCode[i]!)),
      tempMin: Math.min(...temps),
      tempMax: Math.max(...temps),
      rainMm: Math.round(all.reduce((s, i) => s + h.precip[i]!, 0) * 10) / 10,
      rainProb: probs.length > 0 ? Math.max(...probs) : null,
      windMax: Math.max(...all.map((i) => h.windSpeed[i]!)),
      gustMax: h.windGust[gi]!,
      gustDir: h.windDir[gi]!,
      seaTemp: sea.length > 0 ? sea.reduce((a, b) => a + b, 0) / sea.length : null,
    });
  }
  return out;
}
