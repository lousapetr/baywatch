import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FetchStatus } from '../shared/types.ts';
import { SPOTS } from '../shared/spots.ts';
import { buildForecast, groupCells } from './build.ts';
import { fetchMarine, fetchWeather, type FetchOptions } from './openMeteo.ts';

export interface RunOptions extends FetchOptions {
  outDir: string;
  /** Unix seconds; defaults to the current time. */
  now?: number;
  /** Second attempt of the same cron run; does not count as a new failure. */
  retry?: boolean;
}

const emptyStatus = (now: number): FetchStatus => ({
  version: 1,
  lastAttemptAt: now,
  lastSuccessAt: null,
  consecutiveFailures: 0,
  lastError: null,
});

async function readStatus(file: string, now: number): Promise<FetchStatus> {
  try {
    const s = JSON.parse(await readFile(file, 'utf8')) as Partial<FetchStatus>;
    const base = emptyStatus(now);
    return {
      ...base,
      lastSuccessAt: typeof s.lastSuccessAt === 'number' ? s.lastSuccessAt : null,
      consecutiveFailures:
        typeof s.consecutiveFailures === 'number' && s.consecutiveFailures >= 0 ? Math.floor(s.consecutiveFailures) : 0,
      lastError: typeof s.lastError === 'string' ? s.lastError : null,
    };
  } catch {
    return emptyStatus(now);
  }
}

async function writeAtomic(file: string, json: string): Promise<void> {
  const tmp = `${file}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  try {
    await writeFile(tmp, json);
    await rename(tmp, file);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

/**
 * Wraps a run with `status.json` bookkeeping. The failure is counted before the
 * work starts so a hard kill is counted too; a retry attempt does not count again.
 * Status I/O errors never fail the run; they are returned/appended as a note.
 */
export async function run(opts: RunOptions): Promise<string> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const file = join(opts.outDir, 'status.json');
  const status = await readStatus(file, now);
  if (!opts.retry) status.consecutiveFailures += 1;
  status.lastAttemptAt = now;
  const notes: string[] = [];
  const save = async () => {
    try {
      await writeAtomic(file, JSON.stringify(status));
    } catch (e) {
      notes.push(`status write failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  await save();
  let line: string;
  try {
    line = await fetchAndWrite({ ...opts, now });
  } catch (e) {
    status.lastError = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, ' ').slice(0, 200);
    await save();
    throw e;
  }
  status.consecutiveFailures = 0;
  status.lastSuccessAt = now;
  status.lastError = null;
  await save();
  return notes.length ? `${line} ${notes.join('; ')}` : line;
}

/** Fetch, build and atomically write `forecast.json`; returns the one-line log. Throws on any failure. */
async function fetchAndWrite(opts: RunOptions & { now: number }): Promise<string> {
  const { now } = opts;
  const notes: string[] = [];
  const fopts: FetchOptions = { ...opts, warn: (m) => notes.push(m) };
  const marine = await fetchMarine(SPOTS.map((s) => ({ lat: s.lat, lon: s.lon })), fopts);
  const groups = groupCells(SPOTS, marine);
  const weather = await fetchWeather(groups.map((g) => g.weatherPoint), fopts);
  const forecast = buildForecast({ now, spots: SPOTS, marine, weather });

  const json = JSON.stringify(forecast);
  await writeAtomic(join(opts.outDir, 'forecast.json'), json);
  const cells = groups.map((g) => `${g.id}[${g.spotIdx.map((i) => SPOTS[i]!.id).join('+')}]`).join(' ');
  const warn = notes.length ? ` warn: ${notes.join('; ').replace(/\s+/g, ' ')}` : '';
  return `${new Date(now * 1000).toISOString()} ok ${Buffer.byteLength(json)} bytes cells: ${cells}${warn}`;
}
