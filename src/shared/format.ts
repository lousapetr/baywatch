export const TIMEZONE = 'Europe/Madrid';
const LOCALE = 'cs-CZ';

const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
});
const weekdayShortFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, weekday: 'short' });
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

const ms = (t: number) => t * 1000;

function localParts(t: number): { year: string; month: string; day: string; hour: number } {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(ms(t))) p[part.type] = part.value;
  return {
    year: p.year ?? '',
    month: p.month ?? '',
    day: p.day ?? '',
    hour: Number(p.hour),
  };
}

/** Date `YYYY-MM-DD` of a unix time in Europe/Madrid. */
export function localDate(t: number): string {
  const p = localParts(t);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hour of day 0–23 of a unix time in Europe/Madrid. */
export function localHour(t: number): number {
  return localParts(t).hour;
}

/** Whole days from date string `a` to `b` (both `YYYY-MM-DD`). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** `14:30` */
export function formatTime(t: number): string {
  return timeFmt.format(ms(t));
}

/** `so` */
export function formatWeekday(t: number): string {
  return weekdayShortFmt.format(ms(t));
}

/** `so 14. 11.` */
export function formatWeekdayDate(t: number): string {
  return weekdayFmt.format(ms(t));
}

/** `dnes` / `zítra` for today and tomorrow in Europe/Madrid, otherwise null. */
export function relativeDay(t: number, now: number): 'dnes' | 'zítra' | null {
  const d = dayDiff(localDate(now), localDate(t));
  if (d === 0) return 'dnes';
  if (d === 1) return 'zítra';
  return null;
}

/** `dnes`, `zítra` or the short weekday date. */
export function formatDayLabel(t: number, now: number): string {
  return relativeDay(t, now) ?? formatWeekdayDate(t);
}

/** `2 h 10 min`, `45 min`, `3 h`; rounded to whole minutes. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const numberFmts = new Map<number, Intl.NumberFormat>();

/** Number with Czech decimal comma and a fixed number of decimals; no sign on zero. */
export function formatNumber(n: number, decimals = 1): string {
  let fmt = numberFmts.get(decimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: 'negative',
    });
    numberFmts.set(decimals, fmt);
  }
  return fmt.format(n);
}

export interface WeatherInfo {
  label: string;
  emoji: string;
}

const WMO: Record<number, WeatherInfo> = {
  0: { label: 'jasno', emoji: '☀️' },
  1: { label: 'skoro jasno', emoji: '🌤️' },
  2: { label: 'polojasno', emoji: '⛅' },
  3: { label: 'zataženo', emoji: '☁️' },
  45: { label: 'mlha', emoji: '🌫️' },
  48: { label: 'namrzající mlha', emoji: '🌫️' },
  51: { label: 'slabé mrholení', emoji: '🌦️' },
  53: { label: 'mrholení', emoji: '🌦️' },
  55: { label: 'silné mrholení', emoji: '🌧️' },
  56: { label: 'mrznoucí mrholení', emoji: '🌧️' },
  57: { label: 'silné mrznoucí mrholení', emoji: '🌧️' },
  61: { label: 'slabý déšť', emoji: '🌦️' },
  63: { label: 'déšť', emoji: '🌧️' },
  65: { label: 'silný déšť', emoji: '🌧️' },
  66: { label: 'mrznoucí déšť', emoji: '🌧️' },
  67: { label: 'silný mrznoucí déšť', emoji: '🌧️' },
  71: { label: 'slabé sněžení', emoji: '🌨️' },
  73: { label: 'sněžení', emoji: '🌨️' },
  75: { label: 'silné sněžení', emoji: '❄️' },
  77: { label: 'sněhová zrna', emoji: '🌨️' },
  80: { label: 'slabé přeháňky', emoji: '🌦️' },
  81: { label: 'přeháňky', emoji: '🌧️' },
  82: { label: 'silné přeháňky', emoji: '⛈️' },
  85: { label: 'sněhové přeháňky', emoji: '🌨️' },
  86: { label: 'silné sněhové přeháňky', emoji: '❄️' },
  95: { label: 'bouřka', emoji: '⛈️' },
  96: { label: 'bouřka s kroupami', emoji: '⛈️' },
  99: { label: 'silná bouřka s kroupami', emoji: '⛈️' },
};

/** Sun-showing emoji and their night replacements. */
const NIGHT_EMOJI: Record<string, string> = { '☀️': '🌙', '🌤️': '🌙', '⛅': '☁️', '🌦️': '🌧️' };

/** Czech label and emoji for a WMO weather code; at night without a sun. */
export function weatherInfo(code: number, isDay = true): WeatherInfo {
  const w = WMO[code] ?? { label: 'neznámé', emoji: '❓' };
  const night = isDay ? undefined : NIGHT_EMOJI[w.emoji];
  return night ? { ...w, emoji: night } : w;
}
