import { describe, expect, it } from 'vitest';
import { findExtremes } from '../shared/tide.ts';
import { marineFixture } from './fixtures.ts';

describe('tide extremes from the real sea level series', () => {
  const m = marineFixture()[0]!.minutely_15;
  const series = { start: m.time[0]!, step: 900, levelMsl: m.sea_level_height_msl as number[] };
  const ex = findExtremes(series);

  it('finds about two highs and two lows per day', () => {
    const days = series.levelMsl.length / 96;
    expect(ex.length).toBeGreaterThanOrEqual(days * 4 - 3);
    expect(ex.length).toBeLessThanOrEqual(days * 4 + 1);
  });

  it('alternates high and low', () => {
    for (let i = 1; i < ex.length; i++) expect(ex[i]!.type).not.toBe(ex[i - 1]!.type);
  });

  it('spaces consecutive extremes by about 6.2 h', () => {
    for (let i = 1; i < ex.length; i++) {
      const h = (ex[i]!.time - ex[i - 1]!.time) / 3600;
      expect(h).toBeGreaterThan(5);
      expect(h).toBeLessThan(7.5);
    }
  });

  it('puts highs above lows', () => {
    for (let i = 1; i < ex.length; i++) {
      const hi = ex[i]!.type === 'high' ? ex[i]! : ex[i - 1]!;
      const lo = ex[i]!.type === 'low' ? ex[i]! : ex[i - 1]!;
      expect(hi.levelMsl).toBeGreaterThan(lo.levelMsl);
    }
  });
});
