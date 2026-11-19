import { describe, expect, it } from 'vitest';
import { localDate } from '../shared/format.ts';
import { SPOTS } from '../shared/spots.ts';
import { buildForecast, DATUM_OFFSET_M, groupCells } from './build.ts';
import { marineFixture, weatherFixture } from './fixtures.ts';
import { TIDE_TABLE } from './tideTable.ts';

const NOW = 1794650000;
const build = () => buildForecast({ now: NOW, spots: SPOTS, marine: marineFixture(), weather: weatherFixture() });

describe('groupCells', () => {
  it('groups spots by snapped marine grid point', () => {
    const g = groupCells(SPOTS, marineFixture());
    expect(g.map((c) => [c.id, c.spotIdx.map((i) => SPOTS[i]!.id)])).toEqual([
      ['43.5417,-3.875', ['san-juan-canal']],
      ['43.5417,-3.9583', ['costa-quebrada', 'canallave']],
      ['43.5417,-3.7917', ['cabo-mayor', 'sardinero']],
      ['43.5417,-3.625', ['cabo-ajo']],
      ['43.4583,-4.125', ['punta-afuera']],
      ['43.4583,-2.875', ['gaztelugatxe']],
      ['43.4583,-2.4583', ['lekeitio']],
    ]);
    expect(g[1]!.weatherPoint).toEqual({ lat: SPOTS[1]!.lat, lon: SPOTS[1]!.lon });
  });
});

describe('buildForecast (fixtures)', () => {
  const f = build();
  const n = 8 * 24;

  it('has the contract shape', () => {
    expect(f.version).toBe(1);
    expect(f.generatedAt).toBe(NOW);
    expect(f.timezone).toBe('Europe/Madrid');
    expect(f.attribution[0]!.url).toContain('open-meteo.com');
    expect(f.time).toHaveLength(n);
    expect(f.isDay).toHaveLength(n);
    expect(f.cells).toHaveLength(7);
    expect(f.spots).toHaveLength(SPOTS.length);
    expect(f.days).toHaveLength(8);
  });

  it('keeps hourly arrays parallel to time', () => {
    for (const c of f.cells) {
      for (const [k, v] of Object.entries(c.hourly)) expect(v, k).toHaveLength(n);
    }
    for (const s of f.spots) expect(s.score).toHaveLength(n);
  });

  it('maps spots to cells', () => {
    for (const c of f.cells) expect(c.id).toBe(`${c.lat},${c.lon}`);
    const ids = new Set(f.cells.map((c) => c.id));
    for (const s of f.spots) expect(ids.has(s.cell)).toBe(true);
    const cell = (id: string) => f.spots.find((s) => s.id === id)!.cell;
    expect(cell('costa-quebrada')).toBe(cell('canallave'));
    expect(cell('cabo-mayor')).toBe(cell('sardinero'));
    expect(cell('san-juan-canal')).not.toBe(cell('cabo-ajo'));
  });

  it('has no nulls in required cell fields and a swell period for every hour', () => {
    for (const c of f.cells) {
      for (const [k, v] of Object.entries(c.hourly)) {
        if (k === 'seaTemp' || k === 'precipProb') continue;
        expect((v as unknown[]).every((x) => typeof x === 'number'), k).toBe(true);
      }
      expect(Math.min(...c.hourly.swellPeriod)).toBeGreaterThan(0);
    }
  });

  it('rounds values', () => {
    const dp = (x: number) => (String(x).split('.')[1] ?? '').length;
    const h = f.cells[0]!.hourly;
    expect(Math.max(...h.swellHeight.map(dp))).toBeLessThanOrEqual(2);
    expect(Math.max(...h.swellPeriod.map(dp))).toBeLessThanOrEqual(1);
    expect(Math.max(...h.powerKwM.map(dp))).toBeLessThanOrEqual(1);
    expect(Math.max(...h.windDir.map(dp))).toBe(0);
    expect(Math.max(...f.spots[0]!.score.map(dp))).toBeLessThanOrEqual(1);
    expect(Math.max(...f.tide.levelMsl.map(dp))).toBeLessThanOrEqual(2);
  });

  it('derives isDay from sunrise and sunset', () => {
    const d = f.days[1]!;
    const at = (t: number) => f.isDay[f.time.indexOf(t)];
    expect(at(d.sunrise - 3600 - (d.sunrise % 3600))).toBe(false);
    expect(at(d.sunrise - (d.sunrise % 3600) + 3600)).toBe(true);
    expect(at(d.sunset - (d.sunset % 3600) + 3600)).toBe(false);
    expect(f.isDay.filter(Boolean).length).toBeGreaterThan(8 * 8);
    expect(f.isDay.filter(Boolean).length).toBeLessThan(8 * 12);
  });

  it('lists 8 Madrid dates', () => {
    expect(f.days.map((d) => d.date)).toEqual([
      '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17',
      '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21',
    ]);
    for (const d of f.days) expect(localDate(d.sunrise)).toBe(d.date);
  });

  it('builds the tide block from the default spot', () => {
    const t = f.tide;
    expect(t.datumOffsetM).toBe(DATUM_OFFSET_M);
    expect(t.step).toBe(900);
    expect(t.start).toBe(f.time[0]);
    expect(t.levelMsl).toHaveLength(8 * 96);
    expect(t.extremes.length).toBeGreaterThan(24);
    expect(t.days.length).toBeGreaterThanOrEqual(7);
  });

  it('uses the official table where it overlaps the fixture window', () => {
    const t = f.tide;
    const first = TIDE_TABLE.extremes[0]!;
    expect(t.tableUntil).not.toBeNull();
    const e = t.extremes.find((x) => x.time === first.time)!;
    expect(e.levelMsl + t.datumOffsetM).toBeCloseTo(first.heightM, 2);
    expect(f.attribution.map((a) => a.name)).toContain(TIDE_TABLE.name);
  });

  it('falls back to the model without a table', () => {
    const g = buildForecast({ now: NOW, spots: SPOTS, marine: marineFixture(), weather: weatherFixture(), tideTable: { ...TIDE_TABLE, extremes: [] } });
    expect(g.tide.tableUntil).toBeNull();
    expect(g.attribution.map((a) => a.name)).not.toContain(TIDE_TABLE.name);
  });

  it('emits one window per day per spot with plausible content', () => {
    for (const s of f.spots) {
      expect(s.windows.map((w) => w.date)).toEqual(f.days.map((d) => d.date));
      for (const w of s.windows) {
        expect(w.end).toBeGreaterThan(w.start);
        expect(w.peakTime).toBeGreaterThanOrEqual(w.start);
        expect(w.peakTime).toBeLessThan(w.end);
        expect(w.stars).toBeGreaterThanOrEqual(0);
        expect(w.stars).toBeLessThanOrEqual(5);
        expect(localDate(w.peakTime)).toBe(w.date);
      }
    }
  });

  it('scores the sheltered spot lower than the exposed one', () => {
    const sum = (id: string) => f.spots.find((s) => s.id === id)!.score.reduce((a, b) => a + b, 0);
    expect(sum('sardinero')).toBeLessThan(sum('cabo-mayor'));
  });

  it('is JSON round-trippable', () => {
    expect(JSON.parse(JSON.stringify(f))).toEqual(f);
  });
});

describe('buildForecast errors', () => {
  it('rejects a wrong number of weather responses', () => {
    expect(() => buildForecast({ now: NOW, spots: SPOTS, marine: marineFixture(), weather: weatherFixture().slice(1) })).toThrow(/weather responses/);
  });

  it('rejects diverging time axes', () => {
    const w = weatherFixture();
    w[2]!.hourly.time = w[2]!.hourly.time.map((t) => t + 3600);
    expect(() => buildForecast({ now: NOW, spots: SPOTS, marine: marineFixture(), weather: w })).toThrow(/time axis/);
  });

  it('forward-fills trailing nulls and falls back from peak to mean swell period', () => {
    const m = marineFixture();
    const mean = m[0]!.hourly.swell_wave_period!;
    m[0]!.hourly.swell_wave_height![191] = null;
    const f = buildForecast({ now: NOW, spots: SPOTS, marine: m, weather: weatherFixture() });
    const h = f.cells[0]!.hourly;
    expect(h.swellHeight[191]).toBe(h.swellHeight[190]);
    expect(h.swellPeriod[191]).toBe(Math.round(mean[191]! * 10) / 10);
  });
});
