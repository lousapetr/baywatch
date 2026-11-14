import type { CellHourly, Forecast, SpotForecast } from '../../shared/types.ts';
import { compass, travelDeg } from '../../shared/geo.ts';
import { formatDayLabel, formatDuration, formatNumber, formatTime, weatherInfo } from '../../shared/format.ts';
import { scoreText, starLabel } from '../../shared/score.ts';
import { needsSafetyWarning } from '../../shared/safety.ts';
import { tideStateAt } from '../../shared/tide.ts';
import { useApp } from '../data.ts';
import { href } from '../router.ts';
import { Arrow } from '../components/Arrow.tsx';
import { SafetyBanner } from '../components/SafetyBanner.tsx';
import { Stars } from '../components/Stars.tsx';
import {
  bestUpcoming, hourIndexAt, isWorthGoing, outlookItems, swellText, upcomingMaxWave, windowHours, windowTideText,
} from '../overview.ts';

function TideNow({ forecast, now }: { forecast: Forecast; now: number }) {
  const { tide } = forecast;
  const end = tide.start + tide.step * (tide.levelMsl.length - 1);
  if (now < tide.start || now > end) return <p class="muted">Data o přílivu pro tuto chvíli chybí.</p>;
  const st = tideStateAt(tide, tide.extremes, now);
  const rising = st.trend === 'rising';
  return (
    <p>
      <span class={`tide-trend ${rising ? 'up' : 'down'}`}>
        <span aria-hidden="true">{rising ? '↑' : '↓'}</span> {rising ? 'stoupá' : 'klesá'}
      </span>
      , {formatNumber(st.level + tide.datumOffsetM, 1)}&nbsp;m
      {st.next && (
        <span class="muted tide-next">
          {st.next.type === 'high' ? 'příliv' : 'odliv'} v {formatTime(st.next.time)} za {formatDuration(st.next.time - now)}
        </span>
      )}
    </p>
  );
}

function NowCard({ forecast, sf, hourly, now, note }: { forecast: Forecast; sf: SpotForecast; hourly: CellHourly; now: number; note: string }) {
  const i = hourIndexAt(forecast.time, now);
  const w = i >= 0 ? weatherInfo(hourly.weatherCode[i]!, forecast.isDay[i]!) : null;
  return (
    <section class="card" aria-labelledby="now-h">
      <h2 id="now-h">Teď</h2>
      <p class="muted small">{note}</p>
      <TideNow forecast={forecast} now={now} />
      {i < 0 ? (
        <p class="muted">Aktuální hodina není v předpovědi.</p>
      ) : (
        <dl class="now-grid">
          <div>
            <dt>Hodnocení</dt>
            <dd>
              <Stars stars={sf.score[i]!} /> <span class="muted small">{starLabel(sf.score[i]!)}</span>
              <span class="visually-hidden">, {scoreText(sf.score[i]!)}</span>
            </dd>
          </div>
          <div>
            <dt>Swell</dt>
            <dd>
              {formatNumber(hourly.swellHeight[i]!)}&nbsp;m · {formatNumber(hourly.swellPeriod[i]!, 0)}&nbsp;s{' '}
              <Arrow deg={travelDeg(hourly.swellDir[i]!)} /> <span class="visually-hidden">od </span>
              {compass(hourly.swellDir[i]!)}
            </dd>
          </div>
          <div>
            <dt>Vítr</dt>
            <dd>
              {Math.round(hourly.windSpeed[i]!)}/{Math.round(hourly.windGust[i]!)}&nbsp;km/h{' '}
              <Arrow deg={travelDeg(hourly.windDir[i]!)} size={14} /> <span class="visually-hidden">od </span>
              {compass(hourly.windDir[i]!)}
            </dd>
          </div>
          <div>
            <dt>Počasí</dt>
            <dd>
              <span role="img" aria-label={w!.label}>
                {w!.emoji}
              </span>{' '}
              {w!.label}, {Math.round(hourly.airTemp[i]!)}&nbsp;°C
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export function Home() {
  const { forecast, spot, cell, now } = useApp();
  const sf = forecast?.spots.find((s) => s.id === spot.id);
  if (!forecast) return null;
  if (!sf || !cell) {
    return (
      <section class="card">
        <h1>Přehled</h1>
        <p>Pro toto místo chybí data.</p>
      </section>
    );
  }
  const hourly = cell.hourly;
  const best = bestUpcoming(sf.windows, forecast.days, now);
  const worth = isWorthGoing(best) ? best : null;
  const maxWave = upcomingMaxWave(forecast.time, forecast.isDay, hourly.waveHeight, forecast.days, now);
  const outlook = outlookItems(forecast.days, sf.windows, forecast.time, forecast.isDay, hourly.swellHeight, now);

  return (
    <>
      <h1 class="visually-hidden">Přehled</h1>
      <NowCard forecast={forecast} sf={sf} hourly={hourly} now={now} note={spot.note} />

      <section class="card" aria-labelledby="go-h">
        <h2 id="go-h">Kdy vyrazit</h2>
        {worth ? (
          <a class="go-link" href={href('/vlny', { d: worth.date })}>
            <span class="go-when">
              {formatDayLabel(worth.start, now)} {windowHours(worth)} <Stars stars={worth.stars} />{' '}
              <span class="small">{starLabel(worth.stars)}</span>
            </span>
            <span class="muted">
              Swell {formatNumber(worth.swellHeight)} m / {formatNumber(worth.swellPeriod, 0)} s od {compass(worth.swellDir)},{' '}
              {windowTideText(worth, forecast.tide.extremes)}
            </span>
          </a>
        ) : (
          <p>V příštích dnech nic velkého.</p>
        )}
        {needsSafetyWarning(worth?.stars ?? 0, maxWave) && <SafetyBanner />}
      </section>

      <section class="card" aria-labelledby="out-h">
        <h2 id="out-h">Výhled</h2>
        <ul class="outlook">
          {outlook.map((o) => (
            <li key={o.date}>
              <a
                href={href('/vlny', { d: o.date })}
                aria-label={`${o.label}: ${o.stars === null ? 'bez dat' : scoreText(o.stars)}, swell ${swellText(o.maxSwell)}`}
              >
                <span class="o-day">{o.top}</span>
                <span class="o-date muted small">{o.bottom}</span>
                {o.stars === null ? <span class="o-stars">–</span> : <Stars stars={o.stars} />}
                <span class="o-swell">{swellText(o.maxSwell)}</span>
              </a>
            </li>
          ))}
        </ul>
        <p class="muted small">Hvězdy = nejlepší okno dne, výška = nejvyšší swell přes den.</p>
      </section>
    </>
  );
}
