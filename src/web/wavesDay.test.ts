import { describe, expect, it } from 'vitest';
import type { BestWindow } from '../shared/types.ts';
import { alignedAxis, dayIndices, inWindow, maxAt, visibleIndices, windowSummary } from './wavesDay.ts';

// 2026-11-15 10:00–13:00 Madrid (UTC+1).
const start = Date.UTC(2026, 10, 15, 9) / 1000;
const w: BestWindow = {
  date: '2026-11-15', start, end: start + 3 * 3600, stars: 3, peakTime: start + 3600,
  swellHeight: 3.2, swellPeriod: 14, swellDir: 315, tideAtPeak: 'rising',
  comfort: { rainMm: 0, gustKmh: 30, tempC: 15 },
};

describe('indices', () => {
  // 2026-11-14 22:00Z = 23:00 Madrid; 23:00Z = 00:00 next day.
  const t0 = Date.UTC(2026, 10, 14, 22) / 1000;
  const time = [0, 1, 2].map((k) => t0 + k * 3600);
  it('groups by Madrid date', () => {
    expect(dayIndices(time, '2026-11-14')).toEqual([0]);
    expect(dayIndices(time, '2026-11-15')).toEqual([1, 2]);
  });
  it('groups a 25-hour DST day', () => {
    // 2026-10-25: Madrid falls back from UTC+2 to UTC+1.
    const d0 = Date.UTC(2026, 9, 24, 22) / 1000;
    const hours = Array.from({ length: 27 }, (_, k) => d0 + k * 3600);
    expect(dayIndices(hours, '2026-10-25')).toHaveLength(25);
  });
  it('hides night hours unless asked', () => {
    expect(visibleIndices([1, 2], [false, true, false], false)).toEqual([1]);
    expect(visibleIndices([1, 2], [false, true, false], true)).toEqual([1, 2]);
  });
});

describe('inWindow', () => {
  it('end is exclusive', () => {
    expect(inWindow(w.start, w)).toBe(true);
    expect(inWindow(w.end, w)).toBe(false);
    expect(inWindow(0, undefined)).toBe(false);
  });
});

describe('windowSummary', () => {
  it('names the window, stars and conditions', () => {
    expect(windowSummary(w)).toEqual({
      lead: 'Nejlepší 10:00–13:00:',
      stars: 3,
      tail: 'pěkné',
      detail: 'Swell 3,2 m / 14 s od SZ, za stoupajícího přílivu.',
    });
  });
  it('says weak days are not worth it', () => {
    expect(windowSummary({ ...w, stars: 1 })).toMatchObject({ lead: 'Nestojí za to:', tail: 'slabé, nejlépe 10:00–13:00' });
    expect(windowSummary({ ...w, stars: 0 })).toMatchObject({ lead: 'Nestojí za to:', tail: 'klid celý den' });
    expect(windowSummary(undefined)).toMatchObject({ lead: 'Pro tento den chybí data.', stars: null });
  });
});

describe('numbers', () => {
  it('maxAt', () => {
    expect(maxAt([1, 5, 3], [0, 2])).toBe(3);
    expect(maxAt([1], [])).toBe(0);
  });
  it('alignedAxis', () => {
    expect(alignedAxis(2.3, 3, 1)).toEqual({ top: 3, unit: 1 });
    expect(alignedAxis(0.2, 3, 1)).toEqual({ top: 3, unit: 1 });
    expect(alignedAxis(13, 3, 1)).toEqual({ top: 15, unit: 5 });
    expect(alignedAxis(5.98, 3, 0.5)).toEqual({ top: 6, unit: 2 });
  });
});
