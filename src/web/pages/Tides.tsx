import { useEffect, useRef } from 'preact/hooks';
import type { TideExtreme } from '../../shared/types.ts';
import { formatDayLabel, formatDuration, formatNumber, formatTime, formatWeekdayDate, localDate, relativeDay } from '../../shared/format.ts';
import { tideStateAt } from '../../shared/tide.ts';
import { RANGE_LABELS, classifyRange } from '../../shared/tideRange.ts';
import { useApp } from '../data.ts';
import { href } from '../router.ts';
import { TideChart } from '../components/TideChart.tsx';
import { chartWindow, extremesIn, groupByDate } from '../tideChart.ts';

const kind = (type: TideExtreme['type']) => (type === 'high' ? 'příliv' : 'odliv');
const arrow = (type: TideExtreme['type']) => (type === 'high' ? '↑' : '↓');

export function Tides() {
  const { forecast, route, now } = useApp();
  const switchRef = useRef<HTMLElement>(null);
  const reqDay = route.params['d'];
  // Centres the selected day chip in the horizontally scrolling switch.
  useEffect(() => {
    const nav = switchRef.current;
    const chip = nav?.querySelector('[aria-current="true"]');
    if (!nav || !chip) return;
    const n = nav.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    nav.scrollLeft += c.left - n.left - (n.width - c.width) / 2;
  }, [reqDay]);
  if (!forecast) return null;
  const { tide, days } = forecast;
  const off = tide.datumOffsetM;
  const today = localDate(now);
  const dates = days.map((d) => d.date);
  const selected = reqDay && dates.includes(reqDay) ? reqDay : dates.includes(today) ? today : (dates[0] ?? today);

  const state = tideStateAt(tide, tide.extremes, now);
  const next = state.next;
  const rising = state.trend === 'rising';
  const { t0, t1 } = chartWindow(tide, selected);
  const inWindow = extremesIn(tide.extremes, t0, t1);
  const chartLabel =
    `Průběh hladiny od ${formatWeekdayDate(t0)} do ${formatWeekdayDate(t1)}. ` +
    inWindow.map((e) => `${kind(e.type)} ${formatDayLabel(e.time, now)} ${formatTime(e.time)}, ${formatNumber(e.levelMsl + off)} m`).join('; ') +
    '. Totéž je v tabulce níže.';

  const byDate = groupByDate(tide.extremes);
  const ranges = tide.days.map((d) => d.rangeM);
  const maxRange = Math.max(...ranges, 0.01);

  return (
    <>
      <section class="card" aria-labelledby="tide-now">
        <h1 id="tide-now">Příliv</h1>
        <p class="tide-now">
          <span class={`tide-trend ${rising ? 'up' : 'down'}`}>{rising ? '↑ stoupá' : '↓ klesá'}</span>
          <span class="tide-level">{formatNumber(state.level + off)} m</span>
        </p>
        {next ? (
          <p class="muted">
            Nejbližší {kind(next.type)} v {formatTime(next.time)} ({formatNumber(next.levelMsl + off)} m), za{' '}
            {formatDuration(next.time - now)}.
          </p>
        ) : (
          <p class="muted">Další extrém už není v předpovědi.</p>
        )}
      </section>

      <section class="card" aria-label="Graf přílivu">
        <nav class="day-switch" aria-label="Den grafu" ref={switchRef}>
          {days.map((d) => (
            <a
              key={d.date}
              class="day-chip"
              href={href('/priliv', { d: d.date })}
              aria-current={d.date === selected ? 'true' : undefined}
            >
              {formatDayLabel(d.sunrise, now)}
            </a>
          ))}
        </nav>
        <TideChart tide={tide} days={days} t0={t0} t1={t1} now={now} label={chartLabel} />
        <p class="muted small">Výška nad přibližným mořským datem (jako v tabulkách přílivu), stínované je noc.</p>
      </section>

      <section class="card" aria-labelledby="tide-table">
        <h2 id="tide-table">Příliv a odliv po dnech</h2>
        {days.map((d) => {
          const list = byDate.get(d.date) ?? [];
          const range = tide.days.find((r) => r.date === d.date)?.rangeM;
          const cls = range === undefined ? null : classifyRange(range, ranges);
          const isToday = d.date === today;
          return (
            <div key={d.date} class={`tide-day${isToday ? ' today' : ''}`} aria-current={isToday ? 'date' : undefined}>
              <div class="tide-day-head">
                <strong>{formatDayLabel(d.sunrise, now)}</strong>
                {relativeDay(d.sunrise, now) && <span class="muted"> {formatWeekdayDate(d.sunrise)}</span>}
              </div>
              {range !== undefined && cls && (
                <div class="range">
                  <div class="range-bar" aria-hidden="true">
                    <span class={`range-fill ${cls}`} style={{ width: `${Math.round((range / maxRange) * 100)}%` }} />
                  </div>
                  <span class="range-text">
                    {formatNumber(range)} m · {RANGE_LABELS[cls]}
                  </span>
                </div>
              )}
              <table class="tide-table">
                <caption class="visually-hidden">Extrémy přílivu {formatWeekdayDate(d.sunrise)}</caption>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.time} class={e.time < now ? 'past' : undefined}>
                      <td class="t">{formatTime(e.time)}</td>
                      <td class="h">{formatNumber(e.levelMsl + off)} m</td>
                      <td class={`k ${e.type}`}>
                        <span aria-hidden="true">{arrow(e.type)}</span> {kind(e.type)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <p class="muted small footnote">
          Časy jsou orientační (±30 min), jde o modelová data, ne o údaje pro navigaci ani plavbu. Výšky jsou přepočtené na
          přibližné mořské datum (+{formatNumber(off)} m) a mohou se o desítky centimetrů lišit od oficiálních tabulek.
        </p>
      </section>
    </>
  );
}
