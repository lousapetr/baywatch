import type { DayInfo } from '../../shared/types.ts';
import { formatNumber } from '../../shared/format.ts';
import { linePath, linearScale } from '../tideChart.ts';
import { alignedAxis } from '../wavesDay.ts';
import { daySpans } from '../weekChart.ts';
import { WEEK_H, WEEK_PLOT as P, WEEK_W, WeekFrame, WeekHits } from './WeekFrame.tsx';

interface Props {
  time: number[];
  days: DayInfo[];
  score: number[];
  swellHeight: number[];
  selected: string;
  today: string;
  hrefFor: (date: string) => string;
  labelFor: (date: string) => string;
  label: string;
}

/** Hourly score (bars, left axis) and swell height (line, right axis) over all days; each day links via `hrefFor`. */
export function WeekScoreChart({ time, days, score, swellHeight, selected, today, hrefFor, labelFor, label }: Props) {
  const spans = daySpans(time);
  const first = spans[0];
  const last = spans[spans.length - 1];
  if (!first || !last) return null;
  const x = linearScale(first.start, last.end, P.l, WEEK_W - P.r);
  const y = linearScale(0, 5, P.b, P.t);
  const hAx = alignedAxis(Math.max(...swellHeight), 5, 0.5);
  const yH = linearScale(0, hAx.top, P.b, P.t);
  const bw = x(first.start + 3600) - x(first.start);
  const selSpan = spans.find((s) => s.date === selected);
  const pts = time.map((t, i): [number, number] => [x(t + 1800), yH(swellHeight[i] ?? 0)]);
  return (
    <svg class="tide-chart" viewBox={`0 0 ${WEEK_W} ${WEEK_H}`} role="group" aria-label={label}>
      <WeekFrame spans={spans} days={days} x={x} selected={selected} today={today} />
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line class="tc-grid" x1={P.l} x2={WEEK_W - P.r} y1={y(v)} y2={y(v)} />
          <text class="tc-axis" x={P.l - 4} y={y(v) + 4} text-anchor="end">
            {v} ★
          </text>
          <text class="tc-axis wc-p" x={WEEK_W - P.r + 4} y={yH(v * hAx.unit) + 4}>
            {formatNumber(v * hAx.unit, hAx.unit % 1 ? 1 : 0)} m
          </text>
        </g>
      ))}
      {time.map((t, i) => {
        const s = score[i] ?? 0;
        const inSel = !!selSpan && t >= selSpan.start && t < selSpan.end;
        return <rect key={t} class={`sc-bar${inSel ? ' in' : ''}`} x={x(t)} y={y(s)} width={bw} height={P.b - y(s)} />;
      })}
      <path class="wk-swell" d={linePath(pts)} />
      <WeekHits spans={spans} x={x} hrefFor={hrefFor} labelFor={labelFor} />
    </svg>
  );
}
