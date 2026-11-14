import type { CellHourly, DayInfo } from '../../shared/types.ts';
import { formatNumber } from '../../shared/format.ts';
import { linePath, linearScale } from '../tideChart.ts';
import { alignedAxis } from '../wavesDay.ts';
import { daySpans, tempAxis } from '../weekChart.ts';
import { WEEK_H, WEEK_PLOT as P, WEEK_W, WeekFrame } from './WeekFrame.tsx';

interface Props {
  time: number[];
  days: DayInfo[];
  hourly: Pick<CellHourly, 'airTemp' | 'precip'>;
  today: string;
  label: string;
}

/** Hourly air temperature (line, left axis, °C) and rain (bars, right axis, mm) over all days. */
export function WeatherChart({ time, days, hourly, today, label }: Props) {
  const spans = daySpans(time);
  const first = spans[0];
  const last = spans[spans.length - 1];
  if (!first || !last) return null;
  const x = linearScale(first.start, last.end, P.l, WEEK_W - P.r);
  const tAx = tempAxis(Math.min(...hourly.airTemp), Math.max(...hourly.airTemp), 4);
  const yT = linearScale(tAx.lo, tAx.top, P.b, P.t);
  const rAx = alignedAxis(Math.max(...hourly.precip), 4, 0.5);
  const yR = linearScale(0, rAx.top, P.b, P.t);
  const bw = x(first.start + 3600) - x(first.start);
  const pts = time.map((t, i): [number, number] => [x(t + 1800), yT(hourly.airTemp[i]!)]);
  return (
    <svg class="tide-chart" viewBox={`0 0 ${WEEK_W} ${WEEK_H}`} role="img" aria-label={label}>
      <WeekFrame spans={spans} days={days} x={x} today={today} />
      {Array.from({ length: 5 }, (_, k) => (
        <g key={k}>
          <line class="tc-grid" x1={P.l} x2={WEEK_W - P.r} y1={yT(tAx.lo + k * tAx.unit)} y2={yT(tAx.lo + k * tAx.unit)} />
          <text class="tc-axis wc-p" x={P.l - 4} y={yT(tAx.lo + k * tAx.unit) + 4} text-anchor="end">
            {tAx.lo + k * tAx.unit} °
          </text>
          <text class="tc-axis wc-h" x={WEEK_W - P.r + 4} y={yR(k * rAx.unit) + 4}>
            {formatNumber(k * rAx.unit, rAx.unit % 1 ? 1 : 0)}
          </text>
        </g>
      ))}
      {time.map((t, i) => {
        const r = hourly.precip[i] ?? 0;
        return r > 0 ? <rect key={t} class="wx-rain" x={x(t)} y={yR(r)} width={bw} height={P.b - yR(r)} /> : null;
      })}
      <path class="wx-line" d={linePath(pts)} />
    </svg>
  );
}
