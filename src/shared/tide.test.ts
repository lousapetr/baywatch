import { describe, expect, it } from 'vitest';
import { dailyRanges, findExtremes, levelAt, tideNorm, tideStateAt, type TideSeries } from './tide.ts';

const HOUR = 3600;
const M2 = 12.4206012 * HOUR;
const S2 = 12 * HOUR;
const START = Date.UTC(2026, 10, 14, 0, 0) / 1000;
const STEP = 900;
const DAYS = 8;

const f = (t: number) =>
  1.2 * Math.cos((2 * Math.PI * (t - START - 2 * HOUR)) / M2) +
  0.4 * Math.cos((2 * Math.PI * (t - START - 5 * HOUR)) / S2) +
  0.1;

function synthetic(): TideSeries {
  const n = DAYS * 96;
  return { start: START, step: STEP, levelMsl: Array.from({ length: n }, (_, i) => f(START + i * STEP)) };
}

/** Reference extremes found on a 10 s grid of the analytic function. */
function truth(end: number) {
  const out: { time: number; level: number; type: 'high' | 'low' }[] = [];
  const dt = 10;
  for (let t = START + dt; t < end - dt; t += dt) {
    const a = f(t - dt);
    const b = f(t);
    const c = f(t + dt);
    if (b > a && b >= c) out.push({ time: t, level: b, type: 'high' });
    else if (b < a && b <= c) out.push({ time: t, level: b, type: 'low' });
  }
  return out;
}

describe('findExtremes', () => {
  const series = synthetic();
  const end = START + (series.levelMsl.length - 1) * STEP;
  const found = findExtremes(series);
  const ref = truth(end);

  it('finds every interior extreme within ±5 min and ±3 cm', () => {
    const interior = ref.filter((r) => r.time > START + 3 * HOUR && r.time < end - 3 * HOUR);
    expect(interior.length).toBeGreaterThan(25);
    for (const r of interior) {
      const m = found.find((x) => Math.abs(x.time - r.time) <= 300);
      expect(m, `extreme at ${r.time}`).toBeDefined();
      expect(m!.type).toBe(r.type);
      expect(Math.abs(m!.levelMsl - r.level)).toBeLessThanOrEqual(0.03);
    }
  });

  it('reports nothing that is not a real extreme', () => {
    for (const x of found) {
      expect(ref.some((r) => Math.abs(r.time - x.time) <= 300 && r.type === x.type)).toBe(true);
    }
  });

  it('alternates high and low, spaced by at least 3 h', () => {
    for (let i = 1; i < found.length; i++) {
      expect(found[i]!.type).not.toBe(found[i - 1]!.type);
      expect(found[i]!.time - found[i - 1]!.time).toBeGreaterThanOrEqual(3 * HOUR);
    }
  });

  it('drops noise wiggles closer than 3 h', () => {
    const noisy: TideSeries = {
      start: START,
      step: STEP,
      levelMsl: series.levelMsl.map((v, i) => v + (i % 2 === 0 ? 0.002 : -0.002)),
    };
    const out = findExtremes(noisy);
    expect(out.length).toBe(found.length);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.type).not.toBe(out[i - 1]!.type);
      expect(out[i]!.time - out[i - 1]!.time).toBeGreaterThanOrEqual(3 * HOUR);
    }
    for (const x of out) {
      expect(ref.some((r) => Math.abs(r.time - x.time) <= 900 && r.type === x.type)).toBe(true);
    }
  });

  it('keeps the more extreme of two highs separated by a dropped low', () => {
    // Highs at samples 2 and 6 with a shallow low at 4 (1 h later, dropped); real low at 30.
    const y = [0, 0.5, 1, 0.95, 0.9, 0.95, 1.1, ...Array.from({ length: 24 }, (_, k) => 1 - k * 0.1), -1.5, -1.4, -1.3];
    const out = findExtremes({ start: START, step: STEP, levelMsl: y });
    expect(out.map((x) => x.type)).toEqual(['high', 'low']);
    expect(out[0]!.levelMsl).toBeGreaterThan(1.1 - 1e-9);
  });

  it('excludes extremes at the edges of the series', () => {
    const y = [0, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
    expect(findExtremes({ start: START, step: STEP, levelMsl: y })).toEqual([]);
    expect(findExtremes({ start: START, step: STEP, levelMsl: [...y].reverse() })).toEqual([]);
  });

  it('handles a flat plateau without NaN', () => {
    const flat: TideSeries = { start: START, step: STEP, levelMsl: [0, 1, 2, 2, 2, 1, 0, -1, -2] };
    for (const x of findExtremes(flat)) expect(Number.isFinite(x.time + x.levelMsl)).toBe(true);
  });
});

describe('levelAt and tideNorm', () => {
  const series = synthetic();
  it('interpolates between samples and clamps outside', () => {
    const t = START + 5 * STEP + 450;
    expect(levelAt(series, t)).toBeCloseTo((series.levelMsl[5]! + series.levelMsl[6]!) / 2, 10);
    expect(levelAt(series, START - 1e5)).toBe(series.levelMsl[0]);
    expect(levelAt(series, START + 1e8)).toBe(series.levelMsl[series.levelMsl.length - 1]);
  });

  it('normalises to 0–1 over the whole window', () => {
    const lo = Math.min(...series.levelMsl);
    const hi = Math.max(...series.levelMsl);
    const iHi = series.levelMsl.indexOf(hi);
    const iLo = series.levelMsl.indexOf(lo);
    expect(tideNorm(series, START + iHi * STEP)).toBeCloseTo(1, 10);
    expect(tideNorm(series, START + iLo * STEP)).toBeCloseTo(0, 10);
  });

  it('returns 0.5 for a flat series', () => {
    expect(tideNorm({ start: 0, step: STEP, levelMsl: [1, 1, 1] }, 100)).toBe(0.5);
  });
});

describe('tideStateAt', () => {
  const series = synthetic();
  const ex = findExtremes(series);

  it('reports trend and progress between extremes', () => {
    const a = ex[2]!;
    const b = ex[3]!;
    const mid = (a.time + b.time) / 2;
    const s = tideStateAt(series, ex, mid);
    expect(s.prev).toEqual(a);
    expect(s.next).toEqual(b);
    expect(s.fraction).toBeCloseTo(0.5, 5);
    expect(s.trend).toBe(b.type === 'high' ? 'rising' : 'falling');
  });

  it('copes with missing neighbours', () => {
    const before = tideStateAt(series, ex, ex[0]!.time - 600);
    expect(before.prev).toBeNull();
    expect(before.fraction).toBeNull();
    expect(before.trend).toBe(ex[0]!.type === 'high' ? 'rising' : 'falling');
    const last = ex[ex.length - 1]!;
    const after = tideStateAt(series, ex, last.time + 600);
    expect(after.next).toBeNull();
    expect(after.trend).toBe(last.type === 'high' ? 'falling' : 'rising');
  });

  it('falls back to the series slope without extremes', () => {
    expect(tideStateAt({ start: 0, step: STEP, levelMsl: [0, 1, 2] }, [], 0).trend).toBe('rising');
    expect(tideStateAt({ start: 0, step: STEP, levelMsl: [2, 1, 0] }, [], 0).trend).toBe('falling');
  });
});

describe('dailyRanges', () => {
  const series = synthetic();
  const ex = findExtremes(series);
  const days = dailyRanges(ex);

  it('groups by Europe/Madrid date, omitting the partial last day', () => {
    // Series spans 01:00 on 14 Nov to 00:45 on 22 Nov local time.
    expect(days.map((d) => d.date)).toEqual(
      Array.from({ length: DAYS }, (_, i) => `2026-11-${String(14 + i).padStart(2, '0')}`),
    );
  });

  it('uses highest high minus lowest low of the date', () => {
    const d = days[2]!;
    const same = ex.filter((e) => new Date(e.time * 1000 + 3600_000).toISOString().slice(0, 10) === d.date);
    const hi = Math.max(...same.filter((e) => e.type === 'high').map((e) => e.levelMsl));
    const lo = Math.min(...same.filter((e) => e.type === 'low').map((e) => e.levelMsl));
    expect(d.rangeM).toBeCloseTo(hi - lo, 2);
  });

  it('omits dates lacking a high or a low', () => {
    expect(dailyRanges([])).toEqual([]);
    expect(dailyRanges([{ time: START + 12 * HOUR, levelMsl: 1, type: 'high' }])).toEqual([]);
  });

  it('splits dates at local midnight across the October DST change', () => {
    // 2026-10-25: CEST→CET; 23:30 UTC is already 26 Oct (00:30 CET).
    const d = Date.UTC(2026, 9, 25, 0) / 1000;
    const out = dailyRanges([
      { time: d + 2 * HOUR, levelMsl: 1, type: 'high' },
      { time: d + 8 * HOUR, levelMsl: -1, type: 'low' },
      { time: d + 23.5 * HOUR, levelMsl: 2, type: 'high' },
      { time: d + 29 * HOUR, levelMsl: -2, type: 'low' },
    ]);
    expect(out).toEqual([
      { date: '2026-10-25', rangeM: 2 },
      { date: '2026-10-26', rangeM: 4 },
    ]);
  });
});
