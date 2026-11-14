import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { Route } from './router.ts';
import { FETCH_FAILURE_ALERT, type CellForecast, type FetchStatus, type Forecast } from '../shared/types.ts';
import { DEFAULT_SPOT_ID, SPOTS, type Spot } from '../shared/spots.ts';

export type Status = 'loading' | 'ok' | 'error';

export const REFRESH_MS = 15 * 60_000;
export const STALE_AFTER_S = 3 * 3600;
const SPOT_KEY = 'baywatch.spot';

export function isStale(generatedAt: number, now: number): boolean {
  return now - generatedAt > STALE_AFTER_S;
}

export function findSpot(id: string | null | undefined): Spot {
  return SPOTS.find((s) => s.id === id) ?? SPOTS.find((s) => s.id === DEFAULT_SPOT_ID) ?? SPOTS[0]!;
}

/** Cell supplying the spot's hourly data, or undefined when the forecast lacks it. */
export function cellFor(forecast: Forecast, spot: Spot): CellForecast | undefined {
  const sf = forecast.spots.find((s) => s.id === spot.id);
  return sf ? forecast.cells.find((c) => c.id === sf.cell) : undefined;
}

export function loadSpotId(): string {
  try {
    return findSpot(localStorage.getItem(SPOT_KEY)).id;
  } catch {
    return DEFAULT_SPOT_ID;
  }
}

function saveSpotId(id: string): void {
  try {
    localStorage.setItem(SPOT_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

function isForecast(x: unknown): x is Forecast {
  const f = x as Forecast | null;
  return !!f && f.version === 1 && typeof f.generatedAt === 'number' && Array.isArray(f.cells) && Array.isArray(f.spots);
}

async function fetchForecast(): Promise<Forecast> {
  const res = await fetch('./data/forecast.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (!isForecast(json)) throw new Error('invalid forecast');
  return json;
}

/** True when the fetcher reports enough consecutive failures to warn the user. */
export function shouldAlertFailures(s: FetchStatus | null): boolean {
  return !!s && s.consecutiveFailures >= FETCH_FAILURE_ALERT;
}

/** Valid `FetchStatus` or null for anything else. */
export function parseFetchStatus(x: unknown): FetchStatus | null {
  const s = x as FetchStatus | null;
  return !!s && typeof s === 'object' && s.version === 1 && Number.isFinite(s.consecutiveFailures) ? s : null;
}

/**
 * Fetcher status; a server answer that is not a valid status (404, invalid JSON, wrong shape) means
 * "no status" (null). Undefined when the server is unreachable, so the last known status stays.
 */
async function fetchFetchStatus(): Promise<FetchStatus | null | undefined> {
  let res: Response;
  try {
    res = await fetch('./data/status.json', { cache: 'no-cache' });
  } catch {
    return undefined;
  }
  try {
    return res.ok ? parseFetchStatus(await res.json()) : null;
  } catch {
    return null;
  }
}

export interface AppState {
  forecast: Forecast | null;
  /** Latest fetcher status, null when unavailable. */
  fetchStatus: FetchStatus | null;
  status: Status;
  /** Unix seconds, ticks every minute. */
  now: number;
  spot: Spot;
  setSpotId: (id: string) => void;
  /** Hourly cell of the selected spot. */
  cell: CellForecast | undefined;
  reload: () => void;
}

export interface AppCtx extends AppState {
  route: Route;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
}

const nowS = () => Math.floor(Date.now() / 1000);

/** Loads and refreshes the forecast; keeps the last good data on errors. */
export function useAppState(): AppState {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [now, setNow] = useState(nowS);
  const [spotId, setSpotIdState] = useState(loadSpotId);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    let seq = 0;
    const load = () => {
      // Only the latest request may update state.
      const id = ++seq;
      const current = () => alive && id === seq;
      void fetchFetchStatus().then((st) => {
        if (current() && st !== undefined) setFetchStatus(st);
      });
      fetchForecast().then(
        (f) => {
          if (!current()) return;
          setForecast(f);
          setStatus('ok');
        },
        () => {
          if (current()) setStatus('error');
        },
      );
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        load();
        setNow(nowS());
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    // Refetch once a service worker takes control so the forecast lands in its cache.
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
    sw?.addEventListener('controllerchange', load);
    return () => {
      window.removeEventListener('online', load);
      sw?.removeEventListener('controllerchange', load);
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tick]);

  useEffect(() => {
    const timer = setInterval(() => setNow(nowS()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const spot = findSpot(spotId);
  return {
    forecast,
    fetchStatus,
    status,
    now,
    spot,
    setSpotId: (id) => {
      const s = findSpot(id);
      saveSpotId(s.id);
      setSpotIdState(s.id);
    },
    cell: forecast ? cellFor(forecast, spot) : undefined,
    reload: () => {
      setStatus('loading');
      setTick((t) => t + 1);
    },
  };
}
