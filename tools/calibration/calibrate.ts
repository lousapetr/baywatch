// Star calibration data: recomputes effective power for historical Novembers
// with the app's scoring functions and writes calib-data.json for index.html.
// Run: NODE_USE_ENV_PROXY=1 node --experimental-strip-types tools/calibration/calibrate.ts
// View: python3 -m http.server -d tools/calibration
import { writeFileSync } from 'node:fs';
import type { MarineResponse } from '../../src/fetcher/openMeteo.ts';
import { combinedPower, dirFactor, tideFactor } from '../../src/shared/score.ts';
import { SPOTS } from '../../src/shared/spots.ts';
import { tideNorm } from '../../src/shared/tide.ts';

const YEARS = [2023, 2024, 2025];
const SPOT_IDS = ['san-juan-canal', 'costa-quebrada', 'cabo-mayor'];
/** Tide is normalised over 8-day blocks, like the forecast window. */
const WINDOW_H = 192;

const spots = SPOTS.filter((s) => SPOT_IDS.includes(s.id));
const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Nulls take the fallback series, then the last value. */
function fill(s: (number | null)[], fb?: (number | null)[]): number[] {
  let last = 0;
  return s.map((v, i) => (last = v ?? fb?.[i] ?? last));
}

const eff: number[][] = spots.map(() => []);
for (const year of YEARS) {
  const url =
    'https://marine-api.open-meteo.com/v1/marine' +
    `?latitude=${spots.map((s) => s.lat).join(',')}&longitude=${spots.map((s) => s.lon).join(',')}` +
    `&start_date=${year}-11-01&end_date=${year}-11-30&timezone=UTC&timeformat=unixtime&hourly=` +
    'wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_peak_period,swell_wave_direction,sea_level_height_msl';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${year}: HTTP ${res.status}`);
  const body = (await res.json()) as MarineResponse | MarineResponse[];
  const locs = Array.isArray(body) ? body : [body];
  locs.forEach((loc, si) => {
    const s = spots[si]!;
    const h = loc.hourly;
    const wh = fill(h.wave_height!).map((v) => r(v, 2));
    const wp = fill(h.wave_period!).map((v) => r(v, 1));
    const sh = fill(h.swell_wave_height!).map((v) => r(v, 2));
    const sp = fill(h.swell_wave_peak_period!, h.swell_wave_period!).map((v) => r(v, 1));
    const sd = fill(h.swell_wave_direction!).map((v) => r(v, 0));
    const lvl = fill(h.sea_level_height_msl!);
    h.time.forEach((t, k) => {
      const w0 = Math.floor(k / WINDOW_H) * WINDOW_H;
      const series = { start: h.time[w0]!, step: 3600, levelMsl: lvl.slice(w0, w0 + WINDOW_H) };
      const power = r(combinedPower(sh[k]!, sp[k]!, wh[k]!, wp[k]!), 1);
      const e = power * dirFactor(sd[k]!, s.facingDeg) * tideFactor(s.tideWeight, tideNorm(series, t));
      eff[si]!.push(r(e, 2));
    });
  });
}

const out = new URL('./calib-data.json', import.meta.url);
writeFileSync(out, JSON.stringify({ years: YEARS, spots: spots.map((s) => s.id), eff }));
console.log(`${eff.flat().length} hours → ${out.pathname}`);
