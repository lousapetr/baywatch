import { compass, travelDeg } from '../../shared/geo.ts';
import { formatDayLabel, formatNumber, formatTime, localDate, weatherInfo } from '../../shared/format.ts';
import { useApp } from '../data.ts';
import { Arrow } from '../components/Arrow.tsx';
import { WeatherChart } from '../components/WeatherChart.tsx';
import { dayWeather, type DayWeather } from '../weather.ts';
import './Weather.css';

function DayRow({ d, today, now }: { d: DayWeather; today: boolean; now: number }) {
  const w = weatherInfo(d.code);
  return (
    <li class={`wx-day${today ? ' today' : ''}`}>
      <div class="wx-head">
        <span class="wx-icon" role="img" aria-label={w.label}>
          {w.emoji}
        </span>
        <span class="wx-title">
          <strong>{formatDayLabel(d.sunrise, now)}</strong>
          <span class="muted"> · {w.label}</span>
        </span>
        <span class="wx-temp">
          {Math.round(d.tempMin)}–{Math.round(d.tempMax)} °C
        </span>
      </div>
      <dl class="wx-facts">
        <div>
          <dt>Déšť</dt>
          <dd>
            {d.rainMm > 0 ? `${formatNumber(d.rainMm)} mm` : 'bez deště'}
            {d.rainProb !== null && d.rainProb > 0 && ` · ${Math.round(d.rainProb)} %`}
          </dd>
        </div>
        <div>
          <dt>Vítr</dt>
          <dd>
            <Arrow deg={travelDeg(d.gustDir)} size={14} /> <span class="visually-hidden">od {compass(d.gustDir)}, </span>
            {Math.round(d.windMax)}/{Math.round(d.gustMax)} km/h
          </dd>
        </div>
        <div>
          <dt>Slunce</dt>
          <dd>
            {formatTime(d.sunrise)}–{formatTime(d.sunset)}
          </dd>
        </div>
        {d.seaTemp !== null && (
          <div>
            <dt>Moře</dt>
            <dd>{formatNumber(d.seaTemp, 0)} °C</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

export function Weather() {
  const { forecast, spot, cell, now } = useApp();
  if (!forecast) return null;
  if (!cell) {
    return (
      <section class="card">
        <h1>Počasí</h1>
        <p>Pro toto místo chybí data.</p>
      </section>
    );
  }
  const hourly = cell.hourly;
  const today = localDate(now);
  const rows = dayWeather(forecast.time, forecast.isDay, hourly, forecast.days);
  const label = `Teplota vzduchu ${formatNumber(Math.min(...hourly.airTemp), 0)} až ${formatNumber(Math.max(...hourly.airTemp), 0)} °C a déšť po hodinách na 8 dní.`;
  return (
    <>
      <section class="card" aria-labelledby="wx-h">
        <h1 id="wx-h">Počasí</h1>
        <p class="muted small">{spot.name}</p>
        <ul class="wx-days">
          {rows.map((d) => (
            <DayRow key={d.date} d={d} today={d.date === today} now={now} />
          ))}
        </ul>
        <p class="muted small">Šipka u větru ukazuje, kam vítr vane; čísla jsou nejvyšší rychlost větru a náraz za den.</p>
      </section>
      <section class="card" aria-label="Graf počasí">
        <h2>Teplota a déšť</h2>
        <WeatherChart time={forecast.time} days={forecast.days} hourly={hourly} today={today} label={label} />
        <p class="legend small muted" aria-hidden="true">
          <span>
            <span class="lg lg-t" /> teplota (vlevo)
          </span>
          <span>
            <span class="lg lg-r" /> déšť mm/h (vpravo)
          </span>
        </p>
        <p class="muted small">Stínované je noc.</p>
      </section>
    </>
  );
}
