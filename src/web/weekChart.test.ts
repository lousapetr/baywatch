import { describe, expect, it } from 'vitest';
import type { SpotForecast } from '../shared/types.ts';
import { dashboardRows, daySpans, tempAxis } from './weekChart.ts';

describe('daySpans', () => {
  // 22:00Z and 23:00Z on the 14th are 23:00 and 00:00 Madrid.
  const t0 = Date.UTC(2026, 10, 14, 22) / 1000;
  const time = [0, 1, 2, 3].map((k) => t0 + k * 3600);
  it('splits at local midnight', () => {
    expect(daySpans(time)).toEqual([
      { date: '2026-11-14', start: t0, end: t0 + 3600 },
      { date: '2026-11-15', start: t0 + 3600, end: t0 + 4 * 3600 },
    ]);
  });
  it('is empty for no hours', () => expect(daySpans([])).toEqual([]));
});

describe('dashboardRows', () => {
  const sf = (id: string, dates: string[]) =>
    ({ id, name: id.toUpperCase(), windows: dates.map((date) => ({ date })) }) as unknown as SpotForecast;
  it('picks the window of the date, undefined when missing', () => {
    const rows = dashboardRows([sf('a', ['d1', 'd2']), sf('b', ['d2'])], 'd1');
    expect(rows.map((r) => [r.id, r.name, r.win?.date])).toEqual([
      ['a', 'A', 'd1'],
      ['b', 'B', undefined],
    ]);
  });
});

describe('tempAxis', () => {
  it('covers the range in whole steps', () => {
    expect(tempAxis(10.4, 21.2, 3)).toEqual({ lo: 10, unit: 4, top: 22 });
    expect(tempAxis(15, 15, 3)).toEqual({ lo: 15, unit: 1, top: 18 });
  });
});
