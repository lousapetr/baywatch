import type { DayInfo, TideForecast } from '../../shared/types.ts';
import { formatNumber, formatTime, formatWeekdayDate } from '../../shared/format.ts';
import { areaPath, extremesIn, hourTicks, linePath, linearScale, nightBands, seriesPoints, yTicks } from '../tideChart.ts';

// viewBox ≈ the rendered width on a 360 px phone, so font sizes are close to CSS px.
const W = 300;
const PLOT = { l: 30, r: 8, t: 38, b: 170 };
/** Below the lowest possible low-tide label (dot + 25). */
const XLABEL_Y = PLOT.b + 40;
const H = XLABEL_Y + 4;
/** Half width of an extreme label and of an x-axis label, in viewBox units. */
const LBL_HALF = 15;
const NOW_GAP = 24;

interface Props {
  tide: TideForecast;
  days: DayInfo[];
  t0: number;
  t1: number;
  now: number;
  label: string;
}

/** x-axis label position: kept inside the viewBox at the edges. */
function axisText(px: number, halfW: number): { x: number; anchor: 'start' | 'middle' | 'end' } {
  if (px - halfW < 0) return { x: 0, anchor: 'start' };
  if (px + halfW > W) return { x: W, anchor: 'end' };
  return { x: px, anchor: 'middle' };
}

/** Tide curve with night shading, hour axis, labelled extremes and a now marker. */
export function TideChart({ tide, days, t0, t1, now, label }: Props) {
  const pts = seriesPoints(tide, t0, t1, tide.datumOffsetM);
  if (pts.length < 2) return null;
  const heights = pts.map((p) => p[1]);
  const lo = Math.min(...heights);
  const hi = Math.max(...heights);
  const pad = Math.max(0.05, (hi - lo) * 0.04);
  const x = linearScale(t0, t1, PLOT.l, W - PLOT.r);
  const y = linearScale(lo - pad, hi + pad, PLOT.b, PLOT.t);
  const xy = pts.map(([t, h]): [number, number] => [x(t), y(h)]);
  const exts = extremesIn(tide.extremes, t0, t1);
  const nowX = now >= t0 && now <= t1 ? x(now) : null;
  // Hour labels next to the "teď" label are dropped.
  const ticks = hourTicks(t0, t1).map((tk) => ({ ...tk, showLabel: nowX === null || Math.abs(x(tk.t) - nowX) >= NOW_GAP }));
  const clampLabelX = (px: number) => Math.min(W - LBL_HALF, Math.max(PLOT.l + LBL_HALF, px));
  const nowTxt = nowX === null ? null : axisText(nowX, 10);
  const top = PLOT.t - 8;

  return (
    <svg class="tide-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {nightBands(days, t0, t1).map(([a, b]) => (
        <rect key={a} class="tc-night" x={x(a)} y={top} width={x(b) - x(a)} height={PLOT.b - top} />
      ))}
      {yTicks(lo - pad, hi + pad).map((v) => (
        <g key={v}>
          <line class="tc-grid" x1={PLOT.l} x2={W - PLOT.r} y1={y(v)} y2={y(v)} />
          <text class="tc-axis" x={PLOT.l - 4} y={y(v) + 4} text-anchor="end">
            {v} m
          </text>
        </g>
      ))}
      {ticks.map(({ t, hour, showLabel }) => {
        const px = x(t);
        const txt = axisText(px, hour === 0 ? 27 : 7);
        return (
          <g key={t}>
            <line class={hour === 0 ? 'tc-day-line' : 'tc-grid'} x1={px} x2={px} y1={top} y2={PLOT.b + 4} />
            {showLabel && (
              <text class={hour === 0 ? 'tc-axis tc-axis-day' : 'tc-axis'} x={txt.x} y={XLABEL_Y} text-anchor={txt.anchor}>
                {hour === 0 ? formatWeekdayDate(t) : hour}
              </text>
            )}
          </g>
        );
      })}
      <path class="tc-area" d={areaPath(xy, PLOT.b)} />
      <path class="tc-line" d={linePath(xy)} />
      {nowX !== null && <line class="tc-now" x1={nowX} x2={nowX} y1={top} y2={XLABEL_Y - 12} />}
      {exts.map((e) => {
        const h = e.levelMsl + tide.datumOffsetM;
        const px = x(e.time);
        const py = y(h);
        const ty = e.type === 'high' ? py - 22 : py + 15;
        const lx = clampLabelX(px);
        return (
          <g key={e.time}>
            <circle class="tc-dot" cx={px} cy={py} r="3.5" />
            <text class="tc-lbl" x={lx} y={ty} text-anchor="middle">
              {formatTime(e.time)}
            </text>
            <text class="tc-lbl tc-lbl-h" x={lx} y={ty + 11} text-anchor="middle">
              {formatNumber(h)} m
            </text>
          </g>
        );
      })}
      {nowTxt && (
        <text class="tc-now-lbl" x={nowTxt.x} y={XLABEL_Y} text-anchor={nowTxt.anchor}>
          teď
        </text>
      )}
    </svg>
  );
}
