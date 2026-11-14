import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SPOTS } from '../shared/spots.ts';
import { buildForecast, groupCells } from './build.ts';
import { fetchMarine, fetchWeather, type FetchOptions } from './openMeteo.ts';

export interface RunOptions extends FetchOptions {
  outDir: string;
  /** Unix seconds; defaults to the current time. */
  now?: number;
}

/** Fetch, build and atomically write `forecast.json`; returns the one-line log. Throws on any failure. */
export async function run(opts: RunOptions): Promise<string> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const notes: string[] = [];
  const fopts: FetchOptions = { ...opts, warn: (m) => notes.push(m) };
  const marine = await fetchMarine(SPOTS.map((s) => ({ lat: s.lat, lon: s.lon })), fopts);
  const groups = groupCells(SPOTS, marine);
  const weather = await fetchWeather(groups.map((g) => g.weatherPoint), fopts);
  const forecast = buildForecast({ now, spots: SPOTS, marine, weather });

  const json = JSON.stringify(forecast);
  const file = join(opts.outDir, 'forecast.json');
  const tmp = `${file}.tmp`;
  await mkdir(opts.outDir, { recursive: true });
  try {
    await writeFile(tmp, json);
    await rename(tmp, file);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
  const cells = groups.map((g) => `${g.id}[${g.spotIdx.map((i) => SPOTS[i]!.id).join('+')}]`).join(' ');
  const warn = notes.length ? ` warn: ${notes.join('; ').replace(/\s+/g, ' ')}` : '';
  return `${new Date(now * 1000).toISOString()} ok ${Buffer.byteLength(json)} bytes cells: ${cells}${warn}`;
}
