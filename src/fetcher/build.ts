// Assemble a Forecast from validated Open-Meteo responses.

import { localDate } from '../shared/format.ts';
import { combinedPower, scoreHour } from '../shared/score.ts';
import { DEFAULT_SPOT_ID, type Spot } from '../shared/spots.ts';
import { dailyRanges, findExtremes, mergeTable, tideNorm, type TideSeries } from '../shared/tide.ts';
import type { CellForecast, CellHourly, DayInfo, Forecast, SpotForecast } from '../shared/types.ts';
import { bestWindows } from '../shared/windows.ts';
import { HOURS, type MarineResponse, type Point, type WeatherResponse } from './openMeteo.ts';
import { TIDE_TABLE, type TideTable } from './tideTable.ts';

/** Offset from mean sea level to Spanish chart datum, m (estimate; IHM table minus published MSL table ≈ 2.45). */
export const DATUM_OFFSET_M = 2.5;

export const ATTRIBUTION = [
  { name: 'Open-Meteo.com', url: 'https://open-meteo.com/' },
  { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
];

export interface CellGroup {
  id: string;
  lat: number;
  lon: number;
  /** Indices into the spot list. */
  spotIdx: number[];
  /** Coordinates the weather is requested at: the group's first spot. */
  weatherPoint: Point;
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** Group spots by the snapped marine grid point; `marine` is parallel to `spots`. */
export function groupCells(spots: readonly Spot[], marine: readonly MarineResponse[]): CellGroup[] {
  const groups = new Map<string, CellGroup>();
  spots.forEach((s, i) => {
    const m = marine[i]!;
    const lat = r4(m.latitude);
    const lon = r4(m.longitude);
    const id = `${lat},${lon}`;
    let g = groups.get(id);
    if (!g) {
      g = { id, lat, lon, spotIdx: [], weatherPoint: { lat: s.lat, lon: s.lon } };
      groups.set(id, g);
    }
    g.spotIdx.push(i);
  });
  return [...groups.values()];
}

const round = (n: number, dp: number) => {
  const k = 10 ** dp;
  return Math.round(n * k) / k;
};

/** Nulls take the fallback series value, else the previous value (the next one at the start). */
function fill(s: (number | null)[], fallback: (number | null)[] | null = null): number[] {
  const out: (number | null)[] = [];
  let last: number | null = null;
  for (let i = 0; i < s.length; i++) {
    const v: number | null = s[i] ?? fallback?.[i] ?? last;
    if (v !== null) last = v;
    out.push(v);
  }
  const first = out.find((v) => v !== null) ?? 0;
  return out.map((v) => v ?? first);
}

const mapRound = (s: number[], dp: number) => s.map((v) => round(v, dp));
const orNull = (s: (number | null)[], dp: number) => s.map((v) => (v === null ? null : round(v, dp)));

function cellHourly(m: MarineResponse, w: WeatherResponse): CellHourly {
  const mh = m.hourly;
  const wh = w.hourly;
  const waveHeight = mapRound(fill(mh.wave_height!), 2);
  const wavePeriod = mapRound(fill(mh.wave_period!), 1);
  const swellHeight = mapRound(fill(mh.swell_wave_height!), 2);
  const swellPeriod = mapRound(fill(mh.swell_wave_peak_period!, mh.swell_wave_period!), 1);
  const powerKwM = swellHeight.map((h, i) =>
    round(combinedPower(h, swellPeriod[i]!, waveHeight[i]!, wavePeriod[i]!), 1),
  );
  return {
    waveHeight,
    wavePeriod,
    waveDir: mapRound(fill(mh.wave_direction!), 0),
    swellHeight,
    swellPeriod,
    swellDir: mapRound(fill(mh.swell_wave_direction!), 0),
    windWaveHeight: mapRound(fill(mh.wind_wave_height!), 2),
    seaTemp: orNull(mh.sea_surface_temperature!, 1),
    powerKwM,
    airTemp: mapRound(fill(wh.temperature_2m!), 1),
    precip: mapRound(fill(wh.precipitation!), 1),
    precipProb: orNull(wh.precipitation_probability!, 0),
    weatherCode: mapRound(fill(wh.weather_code!), 0),
    cloud: mapRound(fill(wh.cloud_cover!), 0),
    windSpeed: mapRound(fill(wh.wind_speed_10m!), 0),
    windGust: mapRound(fill(wh.wind_gusts_10m!), 0),
    windDir: mapRound(fill(wh.wind_direction_10m!), 0),
  };
}

export interface BuildInput {
  now: number;
  spots: readonly Spot[];
  /** Parallel to `spots`. */
  marine: readonly MarineResponse[];
  /** Parallel to `groupCells(spots, marine)`. */
  weather: readonly WeatherResponse[];
  /** Official extremes replacing the model where they cover it. */
  tideTable?: TideTable;
}

export function buildForecast(input: BuildInput): Forecast {
  const { spots, marine, weather } = input;
  const groups = groupCells(spots, marine);
  if (weather.length !== groups.length) throw new Error(`expected ${groups.length} weather responses, got ${weather.length}`);

  const time = marine[0]!.hourly.time;
  if (time.length !== HOURS) throw new Error(`expected ${HOURS} hourly steps, got ${time.length}`);
  const sameTime = (t: number[]) => t.length === time.length && t.every((v, i) => v === time[i]);
  for (const m of marine) if (!sameTime(m.hourly.time)) throw new Error('marine time axes differ');
  for (const w of weather) if (!sameTime(w.hourly.time)) throw new Error('weather time axis differs from marine');

  const defaultIdx = spots.findIndex((s) => s.id === DEFAULT_SPOT_ID);
  if (defaultIdx < 0) throw new Error('default spot missing');
  const defaultGroupIdx = groups.findIndex((g) => g.spotIdx.includes(defaultIdx));

  // Cells
  const hourlyByCell = groups.map((g, gi) => cellHourly(marine[g.spotIdx[0]!]!, weather[gi]!));
  const cells: CellForecast[] = groups.map((g, gi) => ({ id: g.id, lat: g.lat, lon: g.lon, hourly: hourlyByCell[gi]! }));

  // Days and daylight from the default spot's weather
  const daily = weather[defaultGroupIdx]!.daily;
  const days: DayInfo[] = daily.sunrise.map((sunrise, i) => ({
    date: localDate(sunrise),
    sunrise,
    sunset: daily.sunset[i]!,
  }));
  const isDay = time.map((t) => days.some((d) => t >= d.sunrise && t < d.sunset));

  // Tide from the default spot's marine response
  const m15 = marine[defaultIdx]!.minutely_15;
  const model: TideSeries = { start: m15.time[0]!, step: 900, levelMsl: fill(m15.sea_level_height_msl) };
  const table = input.tideTable ?? TIDE_TABLE;
  const merged = mergeTable(
    model,
    findExtremes(model),
    table.extremes.map((e) => ({ time: e.time, levelMsl: e.heightM - DATUM_OFFSET_M, type: e.type })),
  );
  const series: TideSeries = { ...model, levelMsl: mapRound(merged.levelMsl, 2) };
  const extremes = merged.extremes.map((e) => ({ ...e, levelMsl: round(e.levelMsl, 2) }));
  const tide = {
    datumOffsetM: DATUM_OFFSET_M,
    step: 900 as const,
    start: series.start,
    levelMsl: series.levelMsl,
    extremes,
    days: dailyRanges(extremes),
    tableUntil: merged.tableUntil,
  };

  // Spots
  const dates = days.map((d) => d.date);
  const attribution = merged.tableUntil === null ? ATTRIBUTION : [...ATTRIBUTION, { name: table.name, url: table.url }];

  const spotForecasts: SpotForecast[] = spots.map((s, i) => {
    const gi = groups.findIndex((g) => g.spotIdx.includes(i));
    const h = hourlyByCell[gi]!;
    const score = time.map((t, k) =>
      scoreHour({
        powerKwM: h.powerKwM[k]!,
        swellDir: h.swellDir[k]!,
        facingDeg: s.facingDeg,
        tideWeight: s.tideWeight,
        tideNorm: tideNorm(series, t),
      }),
    );
    const windows = bestWindows({ time, isDay, score, hourly: h, tide: { ...series, extremes }, dates });
    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      cell: groups[gi]!.id,
      facingDeg: s.facingDeg,
      note: s.note,
      score,
      windows,
    };
  });

  return {
    version: 1,
    generatedAt: input.now,
    timezone: 'Europe/Madrid',
    attribution,
    time,
    isDay,
    cells,
    tide,
    days,
    spots: spotForecasts,
  };
}
