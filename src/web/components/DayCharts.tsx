import type { DayInfo } from '../../shared/types.ts';
import { formatNumber, formatWeekdayDate } from '../../shared/format.ts';
import { areaPath, hourTicks, linePath, linearScale, nightBands } from '../tideChart.ts';
import { alignedAxis } from '../wavesDay.ts';

const W = 300;
const PLOT = { l: 38, r: 30, t: 8, b: 98 };
const H = PLOT.b + 20;
const DIVISIONS = 3;

interface Props {
  /** Hour start times of the day. */
  times: number[];
  days: DayInfo[];
  label: string;
}

function Frame({ t0, t1, days, x }: { t0: number; t1: number; days: DayInfo[]; x: (t: number) => number }) {
  return (
    <>
      {nightBands(days, t0, t1).map(([a, b]) => (
        <rect key={a} class="tc-night" x={x(a)} y={PLOT.t} width={x(b) - x(a)} height={PLOT.b - PLOT.t} />
      ))}
      {hourTicks(t0, t1).map(({ t, hour }) => (
        <g key={t}>
          <line class="tc-grid" x1={x(t)} x2={x(t)} y1={PLOT.t} y2={PLOT.b + 3} />
          <text class="tc-axis" x={x(t)} y={PLOT.b + 15} text-anchor="middle">
            {hour === 0 ? formatWeekdayDate(t) : `${hour} h`}
          </text>
        </g>
      ))}
    </>
  );
}

/** Swell height (area, left axis) and period (dashed line, right axis) over a day. */
export function WaveChart({ times, days, height, period, label }: Props & { height: number[]; period: number[] }) {
  const first = times[0];
  const last = times[times.length - 1];
  if (first === undefined || last === undefined || times.length < 2) return null;
  const t1 = last + 3600;
  const x = linearScale(first, t1, PLOT.l, W - PLOT.r);
  const px = (t: number) => x(t + 1800);
  const hAx = alignedAxis(Math.max(...height), DIVISIONS, 0.5);
  const pAx = alignedAxis(Math.max(...period), DIVISIONS, 1);
  const yH = linearScale(0, hAx.top, PLOT.b, PLOT.t);
  const yP = linearScale(0, pAx.top, PLOT.b, PLOT.t);
  const hPts = times.map((t, i): [number, number] => [px(t), yH(height[i] ?? 0)]);
  const pPts = times.map((t, i): [number, number] => [px(t), yP(period[i] ?? 0)]);
  return (
    <svg class="tide-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <Frame t0={first} t1={t1} days={days} x={x} />
      {Array.from({ length: DIVISIONS + 1 }, (_, k) => (
        <g key={k}>
          <line class="tc-grid" x1={PLOT.l} x2={W - PLOT.r} y1={yH(k * hAx.unit)} y2={yH(k * hAx.unit)} />
          <text class="tc-axis wc-h" x={PLOT.l - 4} y={yH(k * hAx.unit) + 4} text-anchor="end">
            {formatNumber(k * hAx.unit, hAx.unit % 1 ? 1 : 0)} m
          </text>
          <text class="tc-axis wc-p" x={W - PLOT.r + 4} y={yP(k * pAx.unit) + 4}>
            {k * pAx.unit} s
          </text>
        </g>
      ))}
      <path class="tc-area" d={areaPath(hPts, PLOT.b)} />
      <path class="tc-line" d={linePath(hPts)} />
      <path class="wc-period" d={linePath(pPts)} />
    </svg>
  );
}

/** Score 0–5 as bars over a day; bars inside the best window are emphasised. */
export function ScoreChart({ times, days, score, win, label }: Props & { score: number[]; win: [number, number] | null }) {
  const first = times[0];
  const last = times[times.length - 1];
  if (first === undefined || last === undefined) return null;
  const t1 = last + 3600;
  const x = linearScale(first, t1, PLOT.l, W - PLOT.r);
  const y = linearScale(0, 5, PLOT.b, PLOT.t);
  const bw = x(first + 3600) - x(first);
  return (
    <svg class="tide-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <Frame t0={first} t1={t1} days={days} x={x} />
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line class="tc-grid" x1={PLOT.l} x2={W - PLOT.r} y1={y(v)} y2={y(v)} />
          <text class="tc-axis" x={PLOT.l - 4} y={y(v) + 4} text-anchor="end">
            {v} ★
          </text>
        </g>
      ))}
      {times.map((t, i) => {
        const s = score[i] ?? 0;
        const inWin = !!win && t >= win[0] && t < win[1];
        return <rect key={t} class={`sc-bar${inWin ? ' in' : ''}`} x={x(t) + 0.5} y={y(s)} width={bw - 1} height={PLOT.b - y(s)} />;
      })}
    </svg>
  );
}
