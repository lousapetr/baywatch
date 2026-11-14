import type { DayInfo } from '../../shared/types.ts';
import { formatWeekday } from '../../shared/format.ts';
import { nightBands } from '../tideChart.ts';
import type { DaySpan } from '../weekChart.ts';
import './WeekFrame.css';

export const WEEK_W = 300;
export const WEEK_PLOT = { l: 30, r: 40, t: 8, b: 108 };
/** Spans shorter than this (a stray hour of the next date) get no label or link. */
const MIN_SPAN_S = 6 * 3600;
const full = (s: DaySpan) => s.end - s.start >= MIN_SPAN_S;

export const WEEK_H = WEEK_PLOT.b + 30;

interface FrameProps {
  spans: DaySpan[];
  days: DayInfo[];
  x: (t: number) => number;
  selected?: string;
  today?: string;
}

/** Night shading, day boundaries and weekday/day-number labels of an 8-day chart. */
export function WeekFrame({ spans, days, x, selected, today }: FrameProps) {
  const first = spans[0];
  const last = spans[spans.length - 1];
  if (!first || !last) return null;
  const { t, b } = WEEK_PLOT;
  return (
    <>
      {spans.map((s) =>
        s.date === selected ? <rect key={s.date} class="wk-sel" x={x(s.start)} y={t} width={x(s.end) - x(s.start)} height={b - t} /> : null,
      )}
      {nightBands(days, first.start, last.end).map(([c, d]) => (
        <rect key={c} class="tc-night" x={x(c)} y={t} width={x(d) - x(c)} height={b - t} />
      ))}
      {spans.filter(full).map((s, i) => (
        <g key={s.date}>
          {i > 0 && <line class="tc-day-line" x1={x(s.start)} x2={x(s.start)} y1={t} y2={b + 4} />}
          <text
            class={`tc-axis wk-day${s.date === today || s.date === selected ? ' on' : ''}`}
            x={(x(s.start) + x(s.end)) / 2}
            y={b + 14}
            text-anchor="middle"
          >
            {formatWeekday(s.start)}
          </text>
          <text class="tc-axis wk-num" x={(x(s.start) + x(s.end)) / 2} y={b + 26} text-anchor="middle">
            {Number(s.date.slice(8))}.
          </text>
        </g>
      ))}
    </>
  );
}

interface HitProps {
  spans: DaySpan[];
  x: (t: number) => number;
  hrefFor: (date: string) => string;
  labelFor: (date: string) => string;
}

/** Transparent full-height links, one per day. */
export function WeekHits({ spans, x, hrefFor, labelFor }: HitProps) {
  const { t } = WEEK_PLOT;
  return (
    <>
      {spans.filter(full).map((s) => (
        <a key={s.date} href={hrefFor(s.date)} aria-label={labelFor(s.date)}>
          <rect class="wk-hit" x={x(s.start)} y={t} width={x(s.end) - x(s.start)} height={WEEK_H - t} />
        </a>
      ))}
    </>
  );
}
