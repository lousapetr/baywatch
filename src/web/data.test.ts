import { describe, expect, it } from 'vitest';
import { DEFAULT_SPOT_ID } from '../shared/spots.ts';
import type { CellForecast, FetchStatus, Forecast } from '../shared/types.ts';
import { cellFor, findSpot, isStale, parseFetchStatus, shouldAlertFailures } from './data.ts';

describe('isStale', () => {
  it('flags data older than 3 h', () => {
    expect(isStale(1000, 1000 + 3 * 3600)).toBe(false);
    expect(isStale(1000, 1001 + 3 * 3600)).toBe(true);
  });
});

describe('findSpot', () => {
  it('returns the default for unknown or missing ids', () => {
    expect(findSpot('nope').id).toBe(DEFAULT_SPOT_ID);
    expect(findSpot(null).id).toBe(DEFAULT_SPOT_ID);
    expect(findSpot('cabo-mayor').id).toBe('cabo-mayor');
  });
});

describe('cellFor', () => {
  const cell = (id: string) => ({ id }) as CellForecast;
  const forecast = {
    cells: [cell('a'), cell('b')],
    spots: [{ id: 'cabo-mayor', cell: 'b' }],
  } as unknown as Forecast;
  it("returns the spot's cell", () => {
    expect(cellFor(forecast, findSpot('cabo-mayor'))?.id).toBe('b');
  });
  it('returns undefined when the spot is missing in the forecast', () => {
    expect(cellFor(forecast, findSpot('sardinero'))).toBeUndefined();
  });
});

describe('shouldAlertFailures', () => {
  const st = (n: number): FetchStatus => ({ version: 1, lastAttemptAt: 0, lastSuccessAt: null, consecutiveFailures: n, lastError: null });
  it('alerts from the threshold on, never without status', () => {
    expect(shouldAlertFailures(null)).toBe(false);
    expect(shouldAlertFailures(st(2))).toBe(false);
    expect(shouldAlertFailures(st(3))).toBe(true);
    expect(shouldAlertFailures(st(10))).toBe(true);
  });
});

describe('parseFetchStatus', () => {
  it('accepts a valid status and rejects other shapes', () => {
    const ok = { version: 1, lastAttemptAt: 0, lastSuccessAt: null, consecutiveFailures: 4, lastError: 'x' };
    expect(parseFetchStatus(ok)).toBe(ok);
    for (const bad of [null, 3, 'x', [], {}, { version: 2, consecutiveFailures: 4 }, { version: 1, consecutiveFailures: '4' }]) {
      expect(parseFetchStatus(bad)).toBeNull();
    }
  });
});
