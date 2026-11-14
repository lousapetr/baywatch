import { useApp } from '../data.ts';
import { tideStateAt } from '../../shared/tide.ts';
import { formatDuration, formatNumber, formatTime } from '../../shared/format.ts';
import type { Forecast } from '../../shared/types.ts';

export function TideNow({ forecast, now }: { forecast: Forecast; now: number }) {
  const { tide } = forecast;
  const st = tideStateAt(tide, tide.extremes, now);
  return (
    <p>
      {st.trend === 'rising' ? '↑ stoupá' : '↓ klesá'}, {formatNumber(st.level + tide.datumOffsetM, 1)} m
      {st.next && (
        <>
          {' '}
          – {st.next.type === 'high' ? 'příliv' : 'odliv'} v {formatTime(st.next.time)} za {formatDuration(st.next.time - now)}
        </>
      )}
    </p>
  );
}

export function Home() {
  const { forecast, spot, now } = useApp();
  return (
    <section class="card">
      <h1>Přehled</h1>
      <h2>{spot.name}</h2>
      <p>{spot.note}</p>
      {forecast && <TideNow forecast={forecast} now={now} />}
    </section>
  );
}
