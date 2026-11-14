import { describe, expect, it } from 'vitest';
import type { CellHourly, DayInfo } from '../shared/types.ts';
import { dayWeather, dominantCode } from './weather.ts';

describe('dominantCode', () => {
  it('uses the most frequent sky cover', () => {
    expect(dominantCode([0, 0, 0, 1, 3])).toBe(0);
  });
  it('prefers the cloudier code on ties', () => {
    expect(dominantCode([1, 1, 3, 3])).toBe(3);
  });
  it('lets precipitation seen for 2+ hours win, the most severe first', () => {
    expect(dominantCode([0, 0, 0, 0, 61, 61, 63, 63])).toBe(63);
    expect(dominantCode([0, 0, 0, 61, 61, 95])).toBe(61);
  });
  it('ignores a single stray hour of rain', () => {
    expect(dominantCode([2, 2, 2, 61])).toBe(2);
  });
  it('accepts a single hour when that is all there is', () => {
    expect(dominantCode([61])).toBe(61);
    expect(dominantCode([])).toBe(0);
  });
});

describe('dayWeather', () => {
  // Two days of 3 hours each, UTC noon so local dates are unambiguous.
  const t0 = Date.UTC(2026, 10, 14, 10) / 1000;
  const time = [0, 1, 2, 24, 25, 26].map((k) => t0 + k * 3600);
  const days: DayInfo[] = [
    { date: '2026-11-14', sunrise: 1, sunset: 2 },
    { date: '2026-11-15', sunrise: 3, sunset: 4 },
  ];
  const h = {
    airTemp: [10, 14, 12, 8, 9, 7],
    precip: [0, 0.5, 0.25, 0, 0, 0],
    precipProb: [10, 60, null, null, null, null],
    weatherCode: [0, 3, 3, 61, 61, 61],
    windSpeed: [10, 20, 15, 5, 5, 5],
    windGust: [20, 40, 30, 10, 12, 11],
    windDir: [90, 180, 270, 0, 45, 0],
    seaTemp: [16, 17, null, null, null, null],
  } as unknown as CellHourly;
  it('summarises each date', () => {
    const [a, b] = dayWeather(time, [true, true, false, true, true, true], h, days);
    expect(a).toMatchObject({ tempMin: 10, tempMax: 14, rainMm: 0.8, rainProb: 60, windMax: 20, gustMax: 40, gustDir: 180 });
    expect(a!.code).toBe(3);
    expect(a!.seaTemp).toBeCloseTo(16.5);
    expect(b).toMatchObject({ code: 61, rainProb: null, seaTemp: null });
  });
});
