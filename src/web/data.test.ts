import { describe, expect, it } from 'vitest';
import { DEFAULT_SPOT_ID } from '../shared/spots.ts';
import type { CellForecast, Forecast } from '../shared/types.ts';
import { cellFor, findSpot, isStale } from './data.ts';

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
