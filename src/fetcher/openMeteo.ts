// Open-Meteo requests: timeout, retries with backoff, multi-location with
// per-location fallback, shape validation.

export const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS = 8;
export const HOURS = FORECAST_DAYS * 24;
export const STEPS_15 = HOURS * 4;
/** Required fields must be non-null within this many leading days. */
const REQUIRED_DAYS = 7;
/** A snapped grid point further than this (°) from the request is rejected. */
const MAX_SNAP_DEG = 0.25;

export const MARINE_HOURLY = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'swell_wave_peak_period',
  'wind_wave_height',
  'sea_surface_temperature',
  'sea_level_height_msl',
] as const;
const MARINE_REQUIRED = MARINE_HOURLY.filter(
  (k) => k !== 'swell_wave_peak_period' && k !== 'sea_surface_temperature',
);

export const WEATHER_HOURLY = [
  'temperature_2m',
  'precipitation',
  'precipitation_probability',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
] as const;
const WEATHER_REQUIRED = WEATHER_HOURLY.filter((k) => k !== 'precipitation_probability');

type Series = (number | null)[];

export interface MarineResponse {
  latitude: number;
  longitude: number;
  hourly: { time: number[] } & Record<string, Series>;
  minutely_15: { time: number[]; sea_level_height_msl: Series };
}

export interface WeatherResponse {
  latitude: number;
  longitude: number;
  hourly: { time: number[] } & Record<string, Series>;
  daily: { time: number[]; sunrise: number[]; sunset: number[] };
}

export interface Point {
  lat: number;
  lon: number;
}

export interface FetchOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  /** Delay before retry `n` (1-based), ms. */
  backoffMs?: (n: number) => number;
  sleep?: (ms: number) => Promise<void>;
  /** Receives non-fatal notices (e.g. multi-location fallback). */
  warn?: (msg: string) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** GET JSON with a per-attempt timeout; 5xx, 429 and network errors are retried. */
export async function getJson(url: string, opts: FetchOptions = {}): Promise<unknown> {
  const fetchFn = opts.fetchFn ?? fetch;
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const backoff = opts.backoffMs ?? ((n) => 1000 * 2 ** (n - 1));
  const sleep = opts.sleep ?? defaultSleep;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoff(attempt));
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      if (!res.ok) {
        let reason = text.slice(0, 200);
        try {
          reason = (JSON.parse(text) as { reason?: string }).reason ?? reason;
        } catch {
          /* keep raw text */
        }
        throw new HttpError(res.status, `HTTP ${res.status}: ${reason}`);
      }
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      if (e instanceof HttpError && e.status < 500 && e.status !== 429) break;
    }
  }
  throw new Error(`${redact(url)}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

const redact = (url: string) => url.split('?')[0]!;

function buildUrl(base: string, points: Point[], params: Record<string, string>): string {
  const q = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lon).join(','),
    ...params,
    timezone: 'UTC',
    timeformat: 'unixtime',
    forecast_days: String(FORECAST_DAYS),
  });
  // Keep commas literal for readable URLs.
  return `${base}?${q.toString().replace(/%2C/g, ',')}`;
}

export function marineUrl(points: Point[]): string {
  return buildUrl(MARINE_URL, points, {
    hourly: MARINE_HOURLY.join(','),
    minutely_15: 'sea_level_height_msl',
  });
}

export function weatherUrl(points: Point[]): string {
  return buildUrl(WEATHER_URL, points, {
    hourly: WEATHER_HOURLY.join(','),
    daily: 'sunrise,sunset',
    wind_speed_unit: 'kmh',
  });
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkSeries(where: string, obj: Record<string, unknown>, key: string, len: number, requiredLen: number | null) {
  const s = obj[key];
  if (!Array.isArray(s)) throw new Error(`${where}: ${key} missing`);
  if (s.length !== len) throw new Error(`${where}: ${key} has ${s.length} values, expected ${len}`);
  for (let i = 0; i < s.length; i++) {
    const v = s[i];
    if (v === null && requiredLen !== null && i < requiredLen) throw new Error(`${where}: ${key}[${i}] is null`);
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v))) throw new Error(`${where}: ${key}[${i}] is not a number`);
  }
}

function checkStep(where: string, t: number[], step: number) {
  for (let i = 1; i < t.length; i++) {
    if (t[i]! - t[i - 1]! !== step) throw new Error(`${where}: time step at ${i} is not ${step} s`);
  }
}

function checkPoint(where: string, r: Record<string, unknown>, req: Point | undefined) {
  if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') throw new Error(`${where}: no coordinates`);
  if (req && (Math.abs(r.latitude - req.lat) > MAX_SNAP_DEG || Math.abs(r.longitude - req.lon) > MAX_SNAP_DEG)) {
    throw new Error(`${where}: returned ${r.latitude},${r.longitude} for requested ${req.lat},${req.lon}`);
  }
}

export function validateMarine(r: unknown, where = 'marine', req?: Point): MarineResponse {
  if (!isObj(r)) throw new Error(`${where}: not an object`);
  checkPoint(where, r, req);
  const h = r.hourly;
  const m = r.minutely_15;
  if (!isObj(h) || !isObj(m)) throw new Error(`${where}: hourly/minutely_15 missing`);
  checkSeries(where, h, 'time', HOURS, 0);
  for (const k of MARINE_HOURLY) {
    checkSeries(where, h, k, HOURS, (MARINE_REQUIRED as readonly string[]).includes(k) ? REQUIRED_DAYS * 24 : null);
  }
  checkSeries(where, m, 'time', STEPS_15, 0);
  checkSeries(where, m, 'sea_level_height_msl', STEPS_15, REQUIRED_DAYS * 96);
  const ht = h.time as number[];
  const mt = m.time as number[];
  checkStep(`${where} hourly`, ht, 3600);
  checkStep(`${where} minutely_15`, mt, 900);
  if (mt[0] !== ht[0]) throw new Error(`${where}: minutely_15 and hourly start differ`);
  return r as unknown as MarineResponse;
}

export function validateWeather(r: unknown, where = 'weather', req?: Point): WeatherResponse {
  if (!isObj(r)) throw new Error(`${where}: not an object`);
  checkPoint(where, r, req);
  const h = r.hourly;
  const d = r.daily;
  if (!isObj(h) || !isObj(d)) throw new Error(`${where}: hourly/daily missing`);
  checkSeries(where, h, 'time', HOURS, 0);
  for (const k of WEATHER_HOURLY) {
    checkSeries(where, h, k, HOURS, (WEATHER_REQUIRED as readonly string[]).includes(k) ? REQUIRED_DAYS * 24 : null);
  }
  for (const k of ['time', 'sunrise', 'sunset']) checkSeries(where, d, k, FORECAST_DAYS, FORECAST_DAYS);
  checkStep(`${where} hourly`, h.time as number[], 3600);
  return r as unknown as WeatherResponse;
}

/**
 * One multi-location call; on any failure (request, count mismatch, invalid
 * shape) one call per location. Result is parallel to `points`.
 */
async function fetchMany<T>(
  points: Point[],
  urlFor: (p: Point[]) => string,
  validate: (r: unknown, where: string, req: Point) => T,
  opts: FetchOptions,
): Promise<T[]> {
  const parse = (raw: unknown, pts: Point[]): T[] => {
    const arr = Array.isArray(raw) ? raw : [raw];
    if (arr.length !== pts.length) throw new Error(`expected ${pts.length} locations, got ${arr.length}`);
    return arr.map((r, i) => validate(r, `location ${i} (${pts[i]!.lat},${pts[i]!.lon})`, pts[i]!));
  };
  if (points.length > 1) {
    try {
      return parse(await getJson(urlFor(points), opts), points);
    } catch (e) {
      (opts.warn ?? console.warn)(`multi-location fallback: ${(e as Error).message}`);
    }
  }
  const out: T[] = [];
  for (const p of points) out.push(...parse(await getJson(urlFor([p]), opts), [p]));
  return out;
}

export const fetchMarine = (points: Point[], opts: FetchOptions = {}) =>
  fetchMany(points, marineUrl, validateMarine, opts);

export const fetchWeather = (points: Point[], opts: FetchOptions = {}) =>
  fetchMany(points, weatherUrl, validateWeather, opts);
