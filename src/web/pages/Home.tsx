import type { Forecast } from '../../shared/types.ts';
import { compass, travelDeg } from '../../shared/geo.ts';
import { formatDayLabel, formatDuration, formatNumber, formatTime, weatherInfo } from '../../shared/format.ts';
import { scoreText, starLabel } from '../../shared/score.ts';
import { DEFAULT_SPOT_ID, SPOTS } from '../../shared/spots.ts';
import { tideStateAt } from '../../shared/tide.ts';
import { cellFor, findSpot, useApp } from '../data.ts';
import { href } from '../router.ts';
import { Arrow } from '../components/Arrow.tsx';
import { SafetyBanner } from '../components/SafetyBanner.tsx';
import { Stars } from '../components/Stars.tsx';
import {
  anySafetyWarning, hourIndexAt, summarizeSpot, windowHours, windowTideText, type OutlookItem, type SpotSummary,
} from '../overview.ts';
import './Home.css';

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

/** Current weather of the default spot's cell. */
function WeatherNow({ forecast, now }: { forecast: Forecast; now: number }) {
  const cell = cellFor(forecast, findSpot(DEFAULT_SPOT_ID));
  const i = hourIndexAt(forecast.time, now);
  if (!cell || i < 0) return null;
  const h = cell.hourly;
  const w = weatherInfo(h.weatherCode[i]!, forecast.isDay[i]!);
  return (
    <p class="weather-now">
      <span role="img" aria-label={w.label}>
        {w.emoji}
      </span>{' '}
      {w.label}, {Math.round(h.airTemp[i]!)}&nbsp;°C · vítr {Math.round(h.windSpeed[i]!)}/{Math.round(h.windGust[i]!)}&nbsp;km/h{' '}
      <span class="nowrap">
        <Arrow deg={travelDeg(h.windDir[i]!)} size={14} /> <span class="visually-hidden">od </span>
        {compass(h.windDir[i]!)}
      </span>
    </p>
  );
}

function TideCard({ forecast, now }: { forecast: Forecast; now: number }) {
  return (
    <section class="card" aria-labelledby="tide-h">
      <h2 id="tide-h">Příliv</h2>
      <TideNow forecast={forecast} now={now} />
      <WeatherNow forecast={forecast} now={now} />
    </section>
  );
}

function Outlook({ items, onPick, spotName }: { items: OutlookItem[]; onPick: () => void; spotName: string }) {
  return (
    <ul class="outlook">
      {items.map((o) => (
        <li key={o.date}>
          <a
            href={href('/vlny', { d: o.date })}
            onClick={onPick}
            aria-label={`${spotName}, ${o.label}: ${o.stars === null ? 'bez dat' : scoreText(o.stars)}`}
          >
            <span class="o-day">{o.top}</span>
            <span class={`o-stars s${o.stars === null ? 'x' : Math.round(o.stars)}`}>{o.stars === null ? '–' : `${Math.round(o.stars)}★`}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function SpotCard({ s, forecast, selected, now }: { s: SpotSummary; forecast: Forecast; selected: boolean; now: number }) {
  const { setSpotId } = useApp();
  const pick = () => setSpotId(s.id);
  const best = s.best;
  return (
    <article class={`card spot-card${selected ? ' selected' : ''}`} aria-labelledby={`spot-${s.id}`}>
      <a class="spot-main" href={href('/vlny', { d: s.targetDate })} onClick={pick}>
        <span class="spot-head">
          <span class="spot-name" id={`spot-${s.id}`}>
            {s.name}
          </span>
          {s.nowStars !== null && (
            <span class="spot-now">
              <Stars stars={s.nowStars} />
              <span class="visually-hidden">, {starLabel(s.nowStars)}</span>
            </span>
          )}
        </span>
        {s.nowSwell && (
          <span class="muted spot-swell">
            Swell {formatNumber(s.nowSwell.height)}&nbsp;m · {formatNumber(s.nowSwell.period, 0)}&nbsp;s{' '}
            <Arrow deg={travelDeg(s.nowSwell.dir)} size={14} /> <span class="visually-hidden">od </span>
            {compass(s.nowSwell.dir)}
          </span>
        )}
        <span class="spot-go">
          <span class="go-label">Kdy vyrazit</span>
          {best ? (
            <>
              <span class="go-when">
                {formatDayLabel(best.start, now)} {windowHours(best)} <Stars stars={best.stars} />{' '}
                <span class="small">{starLabel(best.stars)}</span>
              </span>
              <span class="muted small">
                swell {formatNumber(best.swellHeight)} m / {formatNumber(best.swellPeriod, 0)} s od {compass(best.swellDir)},{' '}
                {windowTideText(best, forecast.tide.extremes)}
              </span>
            </>
          ) : (
            <span>V příštích dnech nic velkého.</span>
          )}
        </span>
      </a>
      <Outlook items={s.outlook} onPick={pick} spotName={s.name} />
    </article>
  );
}

export function Home() {
  const { forecast, spot, now } = useApp();
  if (!forecast) return null;
  const summaries = SPOTS.map((sp) => summarizeSpot(forecast, sp.id, now)).filter((s): s is SpotSummary => s !== null);
  return (
    <>
      <h1 class="visually-hidden">Přehled</h1>
      <TideCard forecast={forecast} now={now} />
      {anySafetyWarning(summaries) && <SafetyBanner />}
      {summaries.map((s) => (
        <SpotCard key={s.id} s={s} forecast={forecast} selected={s.id === spot.id} now={now} />
      ))}
      <p class="muted small footnote">
        Hvězdy ve výhledu = nejlepší okno dne. <a href={href('/o-aplikaci')}>O aplikaci, zdroje dat a přesnost</a>
      </p>
    </>
  );
}
