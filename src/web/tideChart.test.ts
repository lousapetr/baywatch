import { describe, expect, it } from 'vitest';
import { areaPath, chartWindow, groupByDate, hourTicks, linePath, linearScale, nightBands, yTicks } from './tideChart.ts';

describe('linearScale', () => {
  it('maps and inverts the range', () => {
    const s = linearScale(0, 10, 100, 0);
    expect(s(0)).toBe(100);
    expect(s(5)).toBe(50);
    expect(linearScale(1, 1, 3, 4)(1)).toBe(3);
  });
});

describe('paths', () => {
  it('builds line and area paths', () => {
    const pts: [number, number][] = [[0, 1], [10, 2.04]];
    expect(linePath(pts)).toBe('M0 1L10 2');
    expect(areaPath(pts, 9)).toBe('M0 1L10 2L10 9L0 9Z');
    expect(areaPath([], 9)).toBe('');
  });
});

describe('yTicks', () => {
  it('returns whole steps inside the range', () => {
    expect(yTicks(0.6, 3.2)).toEqual([1, 2, 3]);
  });
});

describe('nightBands', () => {
  const days = [
    { date: 'a', sunrise: 100, sunset: 200 },
    { date: 'b', sunrise: 300, sunset: 400 },
  ];
  it('clips nights to the window', () => {
    expect(nightBands(days, 50, 350)).toEqual([[50, 100], [200, 300]]);
    expect(nightBands(days, 150, 450)).toEqual([[200, 300], [400, 450]]);
    expect(nightBands(days, 120, 180)).toEqual([]);
  });
});

describe('hourTicks', () => {
  it('uses Madrid local hours (UTC+1 in winter)', () => {
    // 2026-11-15 00:00 UTC = 01:00 local
    const t0 = Date.UTC(2026, 10, 15) / 1000;
    const ticks = hourTicks(t0, t0 + 24 * 3600);
    expect(ticks.map((t) => t.hour)).toEqual([6, 12, 18, 0]);
    expect(ticks[0]!.t).toBe(t0 + 5 * 3600);
  });
});

describe('chartWindow', () => {
  const start = Date.UTC(2026, 10, 14) / 1000;
  const series = { start, step: 900, levelMsl: new Array<number>(96 * 8).fill(0) };
  it('starts at local midnight of the date', () => {
    const w = chartWindow(series, '2026-11-15');
    expect(w.t0).toBe(Date.UTC(2026, 10, 14, 23) / 1000);
    expect(w.t1).toBe(w.t0 + 36 * 3600);
  });
  it('clamps to the series', () => {
    expect(chartWindow(series, '2026-11-14').t0).toBe(start);
    const last = chartWindow(series, '2026-11-21');
    expect(last.t1).toBe(start + (96 * 8 - 1) * 900);
  });
});

describe('groupByDate', () => {
  it('groups by local date', () => {
    const t = Date.UTC(2026, 10, 14, 23, 30) / 1000; // 00:30 on the 15th locally
    const m = groupByDate([
      { time: t - 3600 * 5, levelMsl: 1, type: 'high' },
      { time: t, levelMsl: 0, type: 'low' },
    ]);
    expect([...m.keys()]).toEqual(['2026-11-14', '2026-11-15']);
  });
});
