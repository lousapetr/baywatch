// Data contract of data/forecast.json. All times are unix seconds (UTC).

export interface Forecast {
  version: 1;
  generatedAt: number;
  timezone: 'Europe/Madrid';
  attribution: { name: string; url: string }[];
  /** 8 days × 24, hourly; shared by all cells. */
  time: number[];
  /** Between sunrise and sunset, parallel to `time`. */
  isDay: boolean[];
  /** One per marine grid cell used by the spots. */
  cells: CellForecast[];
  /** From the default spot's cell, shared by all spots. */
  tide: TideForecast;
  /** `date` = YYYY-MM-DD in Europe/Madrid. */
  days: DayInfo[];
  spots: SpotForecast[];
}

export interface TideExtreme {
  time: number;
  levelMsl: number;
  type: 'high' | 'low';
}

export interface TideDay {
  date: string;
  /** Max daily range, a spring/neap hint. */
  rangeM: number;
}

export interface TideForecast {
  /** Added to MSL heights for display (≈ chart datum). */
  datumOffsetM: number;
  step: 900;
  start: number;
  /** 15-min series. */
  levelMsl: number[];
  extremes: TideExtreme[];
  days: TideDay[];
  /** Last extreme taken from the official tide table; null when all data is from the model. */
  tableUntil: number | null;
}

export interface DayInfo {
  date: string;
  sunrise: number;
  sunset: number;
}

export interface CellHourly {
  /** m, total significant height. */
  waveHeight: number[];
  /** s */
  wavePeriod: number[];
  /** ° coming from */
  waveDir: number[];
  swellHeight: number[];
  /** Peak period, falling back to mean. */
  swellPeriod: number[];
  swellDir: number[];
  windWaveHeight: number[];
  seaTemp: (number | null)[];
  /** Wave energy flux, kW/m. */
  powerKwM: number[];
  /** °C */
  airTemp: number[];
  /** mm */
  precip: number[];
  /** % */
  precipProb: (number | null)[];
  /** WMO */
  weatherCode: number[];
  /** % */
  cloud: number[];
  /** km/h */
  windSpeed: number[];
  windGust: number[];
  /** ° coming from */
  windDir: number[];
}

export interface CellForecast {
  /** `${lat},${lon}` of the snapped marine grid point. */
  id: string;
  lat: number;
  lon: number;
  hourly: CellHourly;
}

export interface SpotForecast {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** CellForecast.id supplying this spot's hourly data. */
  cell: string;
  /** Seaward normal of the coast, °. */
  facingDeg: number;
  /** Czech one-liner: what to see, where to stand. */
  note: string;
  /** 0–5 with one decimal, parallel to `time`. */
  score: number[];
  /** Best daylight window per day. */
  windows: BestWindow[];
}

export type TideAtPeak = 'high' | 'rising' | 'falling' | 'low';

export interface BestWindow {
  date: string;
  /** Contiguous hours: `start` is the first hour, `end` the end of the last hour. */
  start: number;
  end: number;
  /** 0–5 integer, peak of the window. */
  stars: number;
  peakTime: number;
  /** At peak. */
  swellHeight: number;
  swellPeriod: number;
  swellDir: number;
  tideAtPeak: TideAtPeak;
  /** Total rain, max gust, mean temperature over the window. */
  comfort: { rainMm: number; gustKmh: number; tempC: number };
}

/** `status.json`, written by the fetcher next to `forecast.json`. */
export interface FetchStatus {
  version: 1;
  /** Unix seconds of the latest cron run start (retries do not count). */
  lastAttemptAt: number;
  lastSuccessAt: number | null;
  /** Cron runs in a row that did not finish successfully, including hard kills. */
  consecutiveFailures: number;
  lastError: string | null;
}

/** Consecutive failed fetch runs after which the app warns the user. */
export const FETCH_FAILURE_ALERT = 3;
