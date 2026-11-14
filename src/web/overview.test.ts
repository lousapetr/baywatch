import { describe, expect, it } from 'vitest';
import type { BestWindow, DayInfo, TideExtreme } from '../shared/types.ts';
import {
  bestUpcoming, hourIndexAt, isWorthGoing, outlookItems, upcomingDates, upcomingMaxWave, windowHours, windowTideText,
} from './overview.ts';

// Madrid is UTC+1 on these dates; day starts at 23:00Z the day before.
const d0 = Date.UTC(2026, 10, 13, 23) / 1000; // 2026-11-14 00:00 local
const time = Array.from({ length: 96 }, (_, i) => d0 + i * 3600);
const dates = ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'];
const days: DayInfo[] = dates.map((date, k) => ({ date, sunrise: d0 + k * 86400 + 8 * 3600, sunset: d0 + k * 86400 + 18 * 3600 }));
const isDay = time.map((_, i) => i % 24 >= 8 && i % 24 < 18);

function win(k: number, h1: number, h2: number, stars: number): BestWindow {
  return {
    date: dates[k]!, start: d0 + k * 86400 + h1 * 3600, end: d0 + k * 86400 + h2 * 3600, stars,
    peakTime: d0 + k * 86400 + h1 * 3600, swellHeight: 3, swellPeriod: 12, swellDir: 315, tideAtPeak: 'rising',
    comfort: { rainMm: 0, gustKmh: 20, tempC: 15 },
  };
}

describe('hourIndexAt', () => {
  it('finds the containing hour', () => {
    expect(hourIndexAt(time, d0 + 3600 * 5 + 1799)).toBe(5);
    expect(hourIndexAt(time, d0)).toBe(0);
  });
  it('is -1 outside the series', () => {
    expect(hourIndexAt(time, d0 - 1)).toBe(-1);
    expect(hourIndexAt(time, d0 + 96 * 3600)).toBe(-1);
  });
});

describe('upcomingDates', () => {
  it('takes today and the next two days', () => {
    expect(upcomingDates(days, d0 + 5 * 3600)).toEqual(dates.slice(0, 3));
    expect(upcomingDates(days, d0 + 30 * 3600)).toEqual(dates.slice(1, 4));
  });
});

describe('bestUpcoming', () => {
  const ws = [win(0, 10, 13, 2), win(1, 14, 17, 4), win(2, 9, 12, 4), win(3, 9, 12, 5)];
  it('picks max stars, earliest on ties, ignores days beyond 3', () => {
    expect(bestUpcoming(ws, days, d0 + 5 * 3600)?.date).toBe('2026-11-15');
  });
  it('ignores a window that already ended today', () => {
    const w = [win(0, 10, 13, 5), win(1, 10, 13, 3)];
    expect(bestUpcoming(w, days, d0 + 14 * 3600)?.date).toBe('2026-11-15');
    expect(bestUpcoming(w, days, d0 + 12 * 3600)?.date).toBe('2026-11-14');
  });
  it('is null without windows', () => {
    expect(bestUpcoming([], days, d0)).toBeNull();
  });
  it('nothing big: only weak windows are not worth going', () => {
    const best = bestUpcoming([win(0, 10, 13, 1), win(1, 10, 13, 0)], days, d0);
    expect(best?.stars).toBe(1);
    expect(isWorthGoing(best)).toBe(false);
    expect(isWorthGoing(win(0, 10, 13, 2))).toBe(true);
    expect(isWorthGoing(null)).toBe(false);
  });
});

describe('window text', () => {
  it('formats local hours', () => {
    expect(windowHours(win(1, 14, 17, 3))).toBe('14–17 h');
  });
  const ex = (h: number, type: 'high' | 'low'): TideExtreme => ({ time: d0 + h * 3600 + 40 * 60, levelMsl: 1, type });
  it('names a high tide near the window', () => {
    expect(windowTideText(win(0, 14, 17, 3), [ex(16, 'high')])).toBe('příliv 16:40');
    expect(windowTideText(win(0, 14, 17, 3), [ex(17, 'high')])).toBe('příliv 17:40');
  });
  it('falls back to the tide state', () => {
    expect(windowTideText(win(0, 14, 17, 3), [ex(22, 'high'), ex(15, 'low')])).toBe('příliv stoupá');
  });
});

describe('upcomingMaxWave', () => {
  it('ignores night, past hours and later days', () => {
    const wave = time.map(() => 1);
    wave[3] = 9; // night
    wave[9] = 5; // past hour today
    wave[24 + 12] = 3.5;
    wave[72 + 12] = 8; // day 4, out of range
    expect(upcomingMaxWave(time, isDay, wave, days, d0 + 10 * 3600)).toBe(3.5);
    expect(upcomingMaxWave(time, isDay, wave, days, d0 + 5 * 3600)).toBe(5);
  });
});

describe('outlookItems', () => {
  it('builds one item per day', () => {
    const swell = time.map((_, i) => (i === 24 + 12 ? 3.2 : 1));
    const items = outlookItems(days, [win(1, 10, 13, 3)], time, isDay, swell, d0 + 5 * 3600);
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ top: 'dnes', stars: null, maxSwell: 1 });
    expect(items[1]).toMatchObject({ top: 'zítra', stars: 3, maxSwell: 3.2 });
    expect(items[2]!.top).toBe('po');
    expect(items[2]!.bottom).toMatch(/^16\.\s?11\.$/);
  });
});
