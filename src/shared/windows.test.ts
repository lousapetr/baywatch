import { describe, expect, it } from 'vitest';
import { localDate } from './format.ts';
import type { TideExtreme } from './types.ts';
import { bestWindows, tideAtPeak, type WindowInput } from './windows.ts';

const HOUR = 3600;
// 2026-11-14 00:00 Madrid (CET = UTC+1)
const T0 = Date.UTC(2026, 10, 13, 23, 0) / 1000;
const N = 48;
const time = Array.from({ length: N }, (_, i) => T0 + i * HOUR);
// Daylight 08:00–17:59 local on both days
const isDay = time.map((_, i) => i % 24 >= 8 && i % 24 < 18);

const flatTide = {
  start: T0,
  step: 900,
  levelMsl: Array.from({ length: N * 4 }, (_, i) => Math.sin((i / 4 / 12.42) * 2 * Math.PI)),
  extremes: [] as TideExtreme[],
};

function input(score: number[]): WindowInput {
  return {
    time,
    isDay,
    score,
    hourly: {
      swellHeight: time.map((_, i) => 1 + i / 10),
      swellPeriod: time.map(() => 12),
      swellDir: time.map(() => 315),
      precip: time.map(() => 0.1),
      windGust: time.map((_, i) => 20 + i),
      airTemp: time.map(() => 15),
    },
    tide: flatTide,
    dates: ['2026-11-14', '2026-11-15'],
  };
}

describe('bestWindows', () => {
  it('uses only daylight hours, even if night scores higher', () => {
    const score = time.map(() => 0);
    score[3] = 5; // night
    score[12] = 2; // 12:00 local
    const [w] = bestWindows(input(score));
    expect(w!.peakTime).toBe(time[12]);
    expect(w!.stars).toBe(2);
  });

  it('extends over adjacent daylight hours within 0.5 of the peak', () => {
    const score = time.map(() => 0);
    score[12] = 3.2;
    score[11] = 2.8;
    score[10] = 2.6; // 0.6 below the peak, breaks the window
    score[13] = 2.7;
    score[14] = 3.0;
    const [w] = bestWindows(input(score));
    expect(w!.start).toBe(time[11]);
    expect(w!.end).toBe(time[14]! + HOUR);
    expect(w!.stars).toBe(3);
  });

  it('includes neighbours exactly 0.5 below the peak despite float error', () => {
    const score = time.map(() => 0);
    score[12] = 2.2;
    score[13] = 1.7;
    const [w] = bestWindows(input(score));
    expect(w!.end).toBe(time[13]! + HOUR);
  });

  it('ignores NaN scores when picking the peak', () => {
    const score = time.map(() => 1);
    score[8] = NaN;
    score[9] = 2;
    const [w] = bestWindows(input(score));
    expect(w!.peakTime).toBe(time[9]);
  });

  it('groups the 25-hour October DST day by local date', () => {
    // 2026-10-25 00:00 CEST = 24 Oct 22:00 UTC; the local day lasts 25 h.
    const t0 = Date.UTC(2026, 9, 24, 22) / 1000;
    const t = Array.from({ length: 26 }, (_, i) => t0 + i * HOUR);
    const inp = input(t.map(() => 1));
    inp.time = t;
    inp.isDay = t.map(() => true);
    inp.dates = ['2026-10-25', '2026-10-26'];
    const [a, b] = bestWindows(inp);
    expect(a!.start).toBe(t[0]);
    expect(a!.end).toBe(t[24]! + HOUR);
    expect(b!.start).toBe(t[25]);
  });

  it('does not extend into the night', () => {
    const score = time.map(() => 4);
    const [w] = bestWindows(input(score));
    expect(w!.start).toBe(time[8]);
    expect(w!.end).toBe(time[17]! + HOUR);
  });

  it('emits a window for every date, even calm days', () => {
    const ws = bestWindows(input(time.map(() => 0)));
    expect(ws.map((w) => w.date)).toEqual(['2026-11-14', '2026-11-15']);
    expect(ws.every((w) => w.stars === 0)).toBe(true);
    expect(localDate(ws[1]!.peakTime)).toBe('2026-11-15');
  });

  it('skips dates without daylight hours', () => {
    const inp = input(time.map(() => 1));
    inp.dates = ['2026-11-14', '2030-01-01'];
    expect(bestWindows(inp)).toHaveLength(1);
  });

  it('takes swell values at the peak and reports comfort over the window', () => {
    const score = time.map(() => 0);
    score[10] = 3;
    score[11] = 3;
    score[12] = 3;
    const [w] = bestWindows(input(score));
    expect(w!.peakTime).toBe(time[10]);
    expect(w!.swellHeight).toBeCloseTo(2, 5);
    expect(w!.swellPeriod).toBe(12);
    expect(w!.swellDir).toBe(315);
    expect(w!.comfort).toEqual({ rainMm: 0.3, gustKmh: 32, tempC: 15 });
  });
});

describe('tideAtPeak', () => {
  const ex: TideExtreme[] = [
    { time: T0 + 2 * HOUR, levelMsl: -1, type: 'low' },
    { time: T0 + 8 * HOUR, levelMsl: 1, type: 'high' },
    { time: T0 + 14 * HOUR, levelMsl: -1, type: 'low' },
  ];
  it('is high/low within 1 h of an extreme', () => {
    expect(tideAtPeak(flatTide, ex, T0 + 8 * HOUR)).toBe('high');
    expect(tideAtPeak(flatTide, ex, T0 + 7 * HOUR)).toBe('high');
    expect(tideAtPeak(flatTide, ex, T0 + 15 * HOUR)).toBe('low');
  });
  it('is rising/falling otherwise', () => {
    expect(tideAtPeak(flatTide, ex, T0 + 5 * HOUR)).toBe('rising');
    expect(tideAtPeak(flatTide, ex, T0 + 11 * HOUR)).toBe('falling');
  });
});
