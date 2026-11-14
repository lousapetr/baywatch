import { describe, expect, it } from 'vitest';
import {
  dayDiff,
  formatDayLabel,
  formatDuration,
  formatNumber,
  formatTime,
  formatWeekdayDate,
  localDate,
  localHour,
  relativeDay,
  weatherInfo,
} from './format.ts';

const utc = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  Date.UTC(y, mo - 1, d, h, mi) / 1000;

describe('format', () => {
  it('formats time in Europe/Madrid (CET in November)', () => {
    expect(formatTime(utc(2026, 11, 14, 13, 30))).toBe('14:30');
    expect(formatTime(utc(2026, 11, 14, 8, 5))).toBe('09:05');
  });

  it('uses CEST in summer', () => {
    expect(formatTime(utc(2026, 7, 1, 12, 0))).toBe('14:00');
  });

  it('formats the short weekday and date', () => {
    expect(formatWeekdayDate(utc(2026, 11, 14, 12))).toBe('so 14. 11.');
  });

  it('computes the local date across midnight, not in UTC', () => {
    expect(localDate(utc(2026, 11, 14, 22, 59))).toBe('2026-11-14');
    expect(localDate(utc(2026, 11, 14, 23, 0))).toBe('2026-11-15');
    expect(localDate(utc(2026, 7, 1, 22, 0))).toBe('2026-07-02');
    expect(localHour(utc(2026, 11, 14, 23, 0))).toBe(0);
    expect(localHour(utc(2026, 11, 14, 12, 0))).toBe(13);
  });

  it('splits local dates correctly around DST changes', () => {
    // 2026-03-29: CET→CEST (23 h day); 2026-10-25: CEST→CET (25 h day).
    expect(localDate(utc(2026, 3, 28, 23, 0))).toBe('2026-03-29');
    expect(localDate(utc(2026, 3, 29, 21, 59))).toBe('2026-03-29');
    expect(localDate(utc(2026, 3, 29, 22, 0))).toBe('2026-03-30');
    expect(formatTime(utc(2026, 3, 29, 1, 0))).toBe('03:00');
    expect(localDate(utc(2026, 10, 24, 22, 0))).toBe('2026-10-25');
    expect(localDate(utc(2026, 10, 25, 22, 59))).toBe('2026-10-25');
    expect(localDate(utc(2026, 10, 25, 23, 0))).toBe('2026-10-26');
    expect(formatTime(utc(2026, 10, 25, 0, 30))).toBe('02:30');
    expect(formatTime(utc(2026, 10, 25, 1, 30))).toBe('02:30');
  });

  it('counts day differences', () => {
    expect(dayDiff('2026-11-14', '2026-11-15')).toBe(1);
    expect(dayDiff('2026-10-31', '2026-11-01')).toBe(1);
    expect(dayDiff('2026-11-14', '2026-11-12')).toBe(-2);
  });

  it('names relative days', () => {
    const now = utc(2026, 11, 14, 10);
    expect(relativeDay(utc(2026, 11, 14, 20), now)).toBe('dnes');
    expect(relativeDay(utc(2026, 11, 15, 10), now)).toBe('zítra');
    expect(relativeDay(utc(2026, 11, 16, 10), now)).toBeNull();
    expect(relativeDay(utc(2026, 11, 13, 10), now)).toBeNull();
    // 23:30 UTC is already tomorrow in Madrid
    expect(relativeDay(utc(2026, 11, 14, 23, 30), now)).toBe('zítra');
    expect(formatDayLabel(utc(2026, 11, 17, 10), now)).toBe('út 17. 11.');
    expect(formatDayLabel(utc(2026, 11, 15, 10), now)).toBe('zítra');
  });

  it('formats durations', () => {
    expect(formatDuration(130 * 60)).toBe('2 h 10 min');
    expect(formatDuration(45 * 60)).toBe('45 min');
    expect(formatDuration(3 * 3600)).toBe('3 h');
    expect(formatDuration(-5)).toBe('0 min');
  });

  it('formats numbers with a decimal comma', () => {
    expect(formatNumber(2.4)).toBe('2,4');
    expect(formatNumber(3, 1)).toBe('3,0');
    expect(formatNumber(12.345, 2)).toBe('12,35');
    expect(formatNumber(7, 0)).toBe('7');
    expect(formatNumber(-0.04)).toBe('0,0');
    expect(formatNumber(-1.25)).toMatch(/^[-−]1,3$/);
  });

  it('maps WMO codes to Czech labels and emoji', () => {
    expect(weatherInfo(0).label).toBe('jasno');
    expect(weatherInfo(95).label).toBe('bouřka');
    expect(weatherInfo(63).emoji).toBe('🌧️');
    expect(weatherInfo(1234).label).toBe('neznámé');
    expect(weatherInfo(0, false)).toEqual({ label: 'jasno', emoji: '🌙' });
    expect(weatherInfo(63, false).emoji).toBe('🌧️');
  });
});
