import { SPOTS } from '../../shared/spots.ts';
import { formatTime, formatWeekdayDate } from '../../shared/format.ts';
import { isStale, shouldAlertFailures, useApp } from '../data.ts';

export function Header() {
  const { forecast, spot, setSpotId, now, status, fetchStatus } = useApp();
  const stale = forecast ? isStale(forecast.generatedAt, now) : false;
  return (
    <header class="header">
      <div class="header-row">
        <label class="visually-hidden" for="spot-select">
          Místo
        </label>
        <select id="spot-select" class="spot-select" value={spot.id} onChange={(e) => setSpotId(e.currentTarget.value)}>
          {SPOTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div class="header-meta">
        {forecast && <span>data z {formatWeekdayDate(forecast.generatedAt)} {formatTime(forecast.generatedAt)}</span>}
        {stale && (
          <span class="chip chip-warn" role="status">
            zastaralá data
          </span>
        )}
        {forecast && status === 'error' && <span class="chip">offline</span>}
      </div>
      {shouldAlertFailures(fetchStatus) && (
        <p class="alert-warn" role="status">
          Stahování předpovědi opakovaně selhává ({fetchStatus?.consecutiveFailures}× po sobě) – data mohou být zastaralá.
        </p>
      )}
    </header>
  );
}
