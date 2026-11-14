import { useState } from 'preact/hooks';
import type { CellHourly, Forecast, SpotForecast } from '../../shared/types.ts';
import { compass, travelDeg } from '../../shared/geo.ts';
import { formatDayLabel, formatNumber, formatTime, formatWeekdayDate, localDate, weatherInfo } from '../../shared/format.ts';
import { scoreText, starLabel } from '../../shared/score.ts';
import { needsSafetyWarning } from '../../shared/safety.ts';
import { tideStateAt } from '../../shared/tide.ts';
import { useApp } from '../data.ts';
import { Arrow } from '../components/Arrow.tsx';
import { DaySwitch } from '../components/DaySwitch.tsx';
import { ScoreChart, WaveChart } from '../components/DayCharts.tsx';
import { SafetyBanner } from '../components/SafetyBanner.tsx';
import { Stars } from '../components/Stars.tsx';
import { selectDay } from '../router.ts';
import { dayIndices, inWindow, maxAt, visibleIndices, windowSummary } from '../wavesDay.ts';

interface RowProps {
  i: number;
  forecast: Forecast;
  hourly: CellHourly;
  score: number;
  highlight: boolean;
}

function HourRow({ i, forecast, hourly: h, score, highlight }: RowProps) {
  const t = forecast.time[i]!;
  const day = forecast.isDay[i]!;
  const tide = tideStateAt(forecast.tide, forecast.tide.extremes, t);
  const rising = tide.trend === 'rising';
  const w = weatherInfo(h.weatherCode[i]!, day);
  const rain = h.precip[i]!;
  return (
    <li class={`wrow${day ? '' : ' night'}${highlight ? ' best' : ''}`}>
      <span class="w-time">
        {formatTime(t)}
        {highlight && <span class="visually-hidden"> (nejlepší okno)</span>}
      </span>
      <div class="w-main">
        <span class="w-stars">
          <span class="w-bar" aria-hidden="true">
            <span style={{ width: `${(score / 5) * 100}%` }} />
          </span>
          <span class="visually-hidden">Hodnocení {scoreText(score)}. </span>
          <span aria-hidden="true">{formatNumber(score)}</span>
        </span>
        <span class="w-swell">
          <strong>{formatNumber(h.swellHeight[i]!)} m</strong> · {formatNumber(h.swellPeriod[i]!, 0)} s
        </span>
        <span class="w-dir">
          <Arrow deg={travelDeg(h.swellDir[i]!)} /> <span class="visually-hidden">vlny od </span>
          {compass(h.swellDir[i]!)}
        </span>
      </div>
      <div class="w-sub">
        <span class="w-wind">
          <Arrow deg={travelDeg(h.windDir[i]!)} size={14} /> <span class="visually-hidden">vítr od {compass(h.windDir[i]!)}, </span>
          {Math.round(h.windSpeed[i]!)}/{Math.round(h.windGust[i]!)} km/h
        </span>
        <span role="img" aria-label={w.label}>
          {w.emoji}
        </span>
        <span>{Math.round(h.airTemp[i]!)} °C</span>
        <span>
          {rain > 0 ? (
            `${formatNumber(rain)} mm`
          ) : (
            <>
              <span aria-hidden="true">–</span>
              <span class="visually-hidden">bez deště</span>
            </>
          )}
        </span>
        <span class={`w-tide ${rising ? 'up' : 'down'}`}>
          <span aria-hidden="true">{rising ? '↑' : '↓'}</span>
          <span class="visually-hidden">{rising ? 'voda stoupá' : 'voda klesá'}</span>{' '}
          {formatNumber(tide.level + forecast.tide.datumOffsetM)} m
        </span>
      </div>
    </li>
  );
}

function dayView(forecast: Forecast, sf: SpotForecast, hourly: CellHourly, date: string, showNight: boolean) {
  const all = dayIndices(forecast.time, date);
  const rows = visibleIndices(all, forecast.isDay, showNight);
  const win = sf.windows.find((w) => w.date === date);
  const daylight = all.filter((i) => forecast.isDay[i]);
  return { all, rows, win, nightCount: all.length - daylight.length, maxWave: maxAt(hourly.waveHeight, daylight) };
}

export function Waves() {
  const { forecast, spot, cell, route, now } = useApp();
  const [showNight, setShowNight] = useState(false);
  const sf = forecast?.spots.find((s) => s.id === spot.id);
  if (!forecast) return null;
  if (!sf || !cell) {
    return (
      <section class="card">
        <h1>Vlny</h1>
        <p>Pro toto místo chybí data.</p>
      </section>
    );
  }

  const { days } = forecast;
  const today = localDate(now);
  const selected = selectDay(
    route.params['d'],
    days.map((d) => d.date),
    today,
  );
  const hourly = cell.hourly;
  const { all, rows, win, nightCount, maxWave } = dayView(forecast, sf, hourly, selected, showNight);
  const day = days.find((d) => d.date === selected);
  const summary = windowSummary(win);
  const times = all.map((i) => forecast.time[i]!);
  const dateLabel = day ? formatWeekdayDate(day.sunrise) : selected;
  const heights = all.map((i) => hourly.swellHeight[i]!);
  const periods = all.map((i) => hourly.swellPeriod[i]!);
  const scores = all.map((i) => sf.score[i]!);
  const peakH = Math.max(0, ...heights);
  const peakP = Math.max(0, ...periods);
  const bestScore = Math.max(0, ...scores);
  const waveLabel = `Swell ${dateLabel}: výška ${formatNumber(Math.min(...heights))} až ${formatNumber(peakH)} m, perioda do ${formatNumber(peakP, 0)} s.`;
  const scoreLabel = `Hodnocení ${dateLabel}: nejvyšší ${scoreText(bestScore)}.`;
  const bestStars = win?.stars ?? 0;

  return (
    <>
      <section class="card" aria-labelledby="waves-h">
        <h1 id="waves-h">Vlny</h1>
        <DaySwitch path="/vlny" days={days} selected={selected} now={now} label="Den" />
        <p class="w-headline">
          {summary.lead}
          {summary.stars !== null && (
            <>
              {' '}
              <Stars stars={summary.stars} /> {summary.tail}
            </>
          )}
        </p>
        {summary.detail && <p class="muted">{summary.detail}</p>}
        {needsSafetyWarning(bestStars, maxWave) && <SafetyBanner />}
        <p class="muted small">{spot.note}</p>
      </section>

      <section class="card" aria-label="Grafy dne">
        <h2>Swell a hodnocení</h2>
        <WaveChart times={times} days={days} height={heights} period={periods} label={waveLabel} />
        <p class="legend small muted" aria-hidden="true">
          <span>
            <span class="lg lg-h" /> výška swellu (vlevo)
          </span>
          <span>
            <span class="lg lg-p" /> perioda (vpravo)
          </span>
        </p>
        <ScoreChart times={times} days={days} score={scores} win={win ? [win.start, win.end] : null} label={scoreLabel} />
        <p class="muted small">Hodnocení po hodinách (0–5 ★), nejlepší okno je zvýrazněné. Stínované je noc.</p>
      </section>

      <section class="card" aria-label="Po hodinách">
        <h2>Po hodinách – {formatDayLabel(day?.sunrise ?? now, now)}</h2>
        <ul class="wrows">
          {rows.map((i) => (
            <HourRow
              key={i}
              i={i}
              forecast={forecast}
              hourly={hourly}
              score={sf.score[i]!}
              highlight={inWindow(forecast.time[i]!, win)}
            />
          ))}
        </ul>
        {nightCount > 0 && (
          <button type="button" class="btn-ghost" aria-expanded={showNight} onClick={() => setShowNight(!showNight)}>
            {showNight ? 'Skrýt noční hodiny' : `Zobrazit noční hodiny (${nightCount})`}
          </button>
        )}
      </section>

      <section class="card" aria-labelledby="legend-h">
        <h2 id="legend-h">Jak číst hodnocení</h2>
        <p class="small">
          Hvězdy 0–5 vyjadřují sílu vln (z výšky a periody swellu), upravenou podle toho, jak přímo vlny míří na pobřeží
          tohoto místa, a podle přílivu. Pohodlí (déšť, vítr, teplota) do hodnocení nepatří – je vedle v řádku.
        </p>
        <p class="small muted">
          Šipky ukazují, kam vlny a vítr míří; zkratka je světová strana, odkud přicházejí.{' '}
          {[0, 1, 2, 3, 4, 5].map((n) => `${n}\u00a0★\u00a0${starLabel(n)}`).join(' · ')}.
        </p>
      </section>
    </>
  );
}
