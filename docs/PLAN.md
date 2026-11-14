# Baywatch – implementation plan

Audience: the coding agent implementing the project. Follow `CLAUDE.md`.
Work through the milestones in order; each ends with `npm run check` passing
and its acceptance criteria met. Tick the boxes as you go.

## 1. Product

A family on holiday near Santander wants two things on their phones:

1. **Tides** – current state (rising/falling, how far to the next high/low),
   times and heights of highs/lows, outlook for the coming days.
2. **Wave show** – they enjoy watching big waves smash into cliffs. They want
   to know *when in the next days it is worth going to the coast* and not
   stand there on flat days. Forecast of swell height, period, direction,
   wind, shore weather, plus a single "quality" rating.

This is **wave watching, not surfing**: bigger and more powerful is better,
onshore wind does not spoil it, high tide helps (waves reach the rock).

Constraints: public, no login, no private data, Czech UI, installable PWA,
tiny server (possibly 1 GB RAM, shared with another app). The project is a
*collection* of simple pages and will grow – keep pages independent and the
data layer shared.

## 2. Verified facts (checked 2026-11-13)

- `https://marine-api.open-meteo.com/v1/marine` works for Santander without a key.
  Requested 43.50/-3.80 snaps to grid cell 43.5417/-3.7917.
- Hourly variables confirmed non-null for 8 days: `wave_height`, `wave_direction`,
  `wave_period`, `swell_wave_height`, `swell_wave_direction`, `swell_wave_period`,
  `wind_wave_height`, `sea_level_height_msl`, `sea_surface_temperature`.
  `swell_wave_peak_period` has **nulls at the end** of the window – always fall back.
- `forecast_days` is documented as max 8. (16 returns data with many nulls – don't use.)
- `minutely_15=sea_level_height_msl` returns 15-minute sea level for this location
  (may be interpolated from hourly; fine for a smooth curve).
- `sea_level_height_msl` includes tides, datum is **global mean sea level**
  (values roughly −1.5…+1.2 m here), ~8 km model, "not for navigation".
  Compared with a published Santander tide table: range matches (~2.6 m that day),
  extremes were **0–50 min early**. Treat times as ±30 min and say so in the UI.
- Published Spanish tide tables use chart datum; offset to MSL is roughly +2.5 m
  (estimated from one day, unverified).
- `https://api.open-meteo.com/v1/forecast` works with hourly `temperature_2m,
  precipitation, precipitation_probability, weather_code, cloud_cover,
  wind_speed_10m, wind_direction_10m, wind_gusts_10m` and daily `sunrise,sunset`.
- Licence CC BY 4.0, attribution with link required. Free tier is non-commercial,
  10 000 calls/day – we make ~50/day.

Not verified – check when you get there:
- Spot coordinates and coast orientations in §5 (estimates).
- Whether `timeformat=unixtime` applies to `minutely_15` and daily sunrise/sunset
  (expected yes).
- Score thresholds in §6 are a first calibration, to be tuned from observation.

## 3. Architecture

```
cron (hourly, server) ─► fetcher (node, one-shot) ─► data/forecast.json
                                                          │
phone ─► Cloudflare Tunnel ─► nginx ─► static site ───────┘ (fetch ./data/forecast.json)
```

- The frontend is fully static and only reads `./data/forecast.json`.
- All domain computation (tide extremes, scores, best windows) happens in the
  fetcher using `src/shared`, so the JSON is ready to render and could later
  feed notifications. The frontend imports `src/shared` only for types and formatting.
- Server layout (`~/baywatch/`): `site/` (built frontend), `fetcher/fetch.mjs`,
  `data/forecast.json`, `nginx/default.conf`, `docker-compose.yml`, `.env`.
  Already defined in `deploy/` and `scripts/deploy.sh` – build output must match:
  `dist/site/` and `dist/fetcher/fetch.mjs`.

### Repo layout

```
src/shared/     types.ts spots.ts tide.ts score.ts windows.ts format.ts geo.ts  (+ *.test.ts)
src/fetcher/    main.ts openMeteo.ts build.ts(assemble Forecast) fixtures/*.json
src/web/        index.html main.tsx app.tsx data.ts styles.css
                pages/{Home,Tides,Waves,About}.tsx  components/*.tsx  public/icons/*
deploy/ scripts/ docs/
```

### npm scripts

| script | does |
| --- | --- |
| `dev` | vite dev server (root `src/web`) |
| `fetch` | run fetcher with `OUT_DIR=src/web/public/data` (via `tsx` or `node --experimental-strip-types`) |
| `build` | `vite build` → `dist/site`, then esbuild bundle `src/fetcher/main.ts` → `dist/fetcher/fetch.mjs` (platform node, format esm, target node22) |
| `test` | vitest run |
| `check` | `tsc --noEmit` + eslint + vitest |

`src/web/public/data/` is gitignored. The production build must **not** ship a `data/` directory
inside `dist/site` (nginx serves `/data/` from a separate folder) – exclude or
delete it in the build step.

## 4. Data contract – `forecast.json`

Define in `src/shared/types.ts`. All times unix seconds UTC. Arrays in `hourly`
are parallel to `hourly.time`. Round numbers on output (heights 2 dp, others 0–1 dp)
to keep the file small.

```ts
interface Forecast {
  version: 1;
  generatedAt: number;
  timezone: 'Europe/Madrid';
  attribution: { name: string; url: string }[];
  hourly: {
    time: number[];                 // 8 days × 24
    waveHeight: number[];           // m, total significant height
    wavePeriod: number[];           // s
    waveDir: number[];              // ° coming from
    swellHeight: number[];
    swellPeriod: number[];          // peak period, falling back to mean
    swellDir: number[];
    windWaveHeight: number[];
    seaTemp: (number | null)[];
    powerKwM: number[];             // wave energy flux, see §6
    airTemp: number[];              // °C
    precip: number[];               // mm
    precipProb: (number | null)[];  // %
    weatherCode: number[];          // WMO
    cloud: number[];                // %
    windSpeed: number[];            // km/h
    windGust: number[];
    windDir: number[];              // ° coming from
    isDay: boolean[];               // between sunrise and sunset
  };
  tide: {
    datumOffsetM: number;           // added to MSL heights for display (≈ chart datum)
    step: 900;
    start: number;
    levelMsl: number[];             // 15-min series
    extremes: { time: number; levelMsl: number; type: 'high' | 'low' }[];
    days: { date: string; rangeM: number }[];   // max daily range → spring/neap hint
  };
  days: { date: string; sunrise: number; sunset: number }[];   // date = YYYY-MM-DD in Europe/Madrid
  spots: SpotForecast[];
}

interface SpotForecast {
  id: string; name: string; lat: number; lon: number;
  facingDeg: number;                // seaward normal of the coast
  note: string;                     // Czech one-liner: what to see, where to stand
  score: number[];                  // 0–5 with one decimal, parallel to hourly.time
  windows: BestWindow[];            // best daylight window per day
}

interface BestWindow {
  date: string; start: number; end: number;   // contiguous hours
  stars: number;                    // 0–5 integer, peak of the window
  peakTime: number;
  swellHeight: number; swellPeriod: number; swellDir: number;   // at peak
  tideAtPeak: 'high' | 'rising' | 'falling' | 'low';
  comfort: { rainMm: number; gustKmh: number; tempC: number };  // mean/max over window
}
```

## 5. Spots (`src/shared/spots.ts`)

One marine request and one weather request serve all spots (they share the
model grid cell); spots differ only in `facingDeg` and `tideWeight`.
Coordinates and orientations are **estimates – verify on a map** and adjust.

| id | name | lat, lon | facingDeg | tideWeight | note |
| --- | --- | --- | --- | --- | --- |
| `san-juan-canal` | Playa de San Juan de la Canal | 43.474, −3.893 | 0 (N) | 0.4 | narrow cove between rock walls, default spot |
| `costa-quebrada` | Costa Quebrada (La Arnía) | 43.476, −3.917 | 340 | 0.4 | rock ribs and stacks, best around high tide |
| `cabo-mayor` | Faro de Cabo Mayor | 43.490, −3.791 | 0 (N) | 0.3 | cliffs under the lighthouse |
| `sardinero` | El Sardinero | 43.474, −3.783 | 60 | 0.2 | sheltered city beach – comparison / calm option |
| `cabo-ajo` | Cabo de Ajo | 43.512, −3.587 | 0 | 0.3 | northernmost cape of Cantabria, very exposed |
| `canallave` | Playa de Canallave | 43.450, −3.962 | 330 | 0.3 | exposed surf beach by the Liencres dunes |
| `punta-afuera` | Punta del Torco de Afuera (Suances) | 43.442, −4.043 | 0 | 0.3 | headland with the Suances lighthouse at the river mouth |

Fetch point: marine `43.50, −3.80`; weather `43.49, −3.79`.

## 6. Domain logic (`src/shared`, pure + tested)

### Tide extremes (`tide.ts`)
- Input: 15-min `levelMsl` series. Find local maxima/minima (sign change of the
  first difference), refine time and height by fitting a parabola through the
  three points around the extreme. Discard extremes closer than 3 h to the
  previous one (noise guard) and ones at the very edges of the series.
- `tideStateAt(t)`: `{ level, trend: 'rising'|'falling', prev, next, fraction }`
  where `fraction` = progress between `prev` and `next` extreme (0–1).
- `tideNorm(t)`: level normalised to 0–1 between the lowest and highest level of the whole window.
- Daily range = max(high) − min(low) for each local date.
- Tests: synthetic M2+S2 sinusoid with known extremes (±5 min, ±3 cm); fixture from the real API.

### Wave power and score (`score.ts`)
Energy flux per metre of wave crest, deep-water approximation:

```
P(H, T) = 0.5 · H² · T                      [kW/m]
power   = max( P(swellHeight, swellPeriod), P(waveHeight, wavePeriod) )
```

Per spot and hour:

```
Δ       = smallest angle between swellDir and spot.facingDeg      (0–180°)
fDir    = Δ ≤ 90 ? max(0.15, cos Δ) : 0.15 · max(0, 1 − (Δ − 90)/30)
fTide   = (1 − tideWeight) + tideWeight · tideNorm(t)
eff     = power · fDir · fTide
```

Stars from `eff` by piecewise-linear interpolation between thresholds
(kW/m → stars): `5→0, 15→1, 30→2, 60→3, 120→4, 200→5`, clamped to 0–5,
one decimal. Thresholds live in one exported constant.

Reference points for tests (fDir = fTide = 1): 1 m/8 s → 4 kW/m → 0★;
2 m/10 s → 20 → ~1.3★; 3 m/12 s → 54 → ~2.8★; 4 m/14 s → 112 → ~3.9★;
5 m/15 s → 187 → ~4.8★.

Czech labels for integer stars: 0 „klid“, 1 „slabé“, 2 „ujde“, 3 „pěkné“,
4 „velké“, 5 „bouře – výjimečné“.

### Best windows (`windows.ts`)
For each local date and spot: consider only hours with `isDay`. Peak = hour
with max score. Extend the window to adjacent daylight hours whose score is
≥ peak − 0.5. `stars = round(peak)`. Emit a window for every day (even 0★, the
UI then says it is not worth going). Comfort is reported, never mixed into the score.

### Formatting (`format.ts`, `geo.ts`)
- `Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Madrid', … })` helpers: time `14:30`,
  weekday `so 14. 11.`, relative day (`dnes`, `zítra`).
- Compass in Czech 16-point abbreviations (S, SSV, SV, … – note S = sever, J = jih).
- WMO weather code → Czech label + emoji/inline SVG icon.
- Local-date helpers (date string of a unix time in Europe/Madrid) – don't use device TZ.

## 7. Fetcher (`src/fetcher`)

- Requests (both with `timezone=UTC&timeformat=unixtime&forecast_days=8`):
  - marine: the hourly variables of §2 + `minutely_15=sea_level_height_msl`
  - forecast: hourly variables of §2 + `daily=sunrise,sunset` + `wind_speed_unit=kmh`
- 20 s timeout, 3 retries with backoff. Validate shape (arrays present, equal
  lengths, no nulls in required fields within the first 7 days) before use.
- Build `Forecast`, write `OUT_DIR/forecast.json` atomically (write `.tmp`, rename).
- **On any failure exit non-zero and leave the previous file untouched.**
- Log one line to stdout per run (timestamp, ok/error, bytes).
- No runtime dependencies; a single bundled `fetch.mjs`.
- Keep recorded API responses in `src/fetcher/fixtures/` and test
  `build.ts` against them (no network in tests).

## 8. Frontend (`src/web`)

### Shell
- Preact + hash routing (`#/`, `#/priliv`, `#/vlny`, `#/o-aplikaci`), hand-rolled – no router lib.
- Bottom tab bar (Přehled · Příliv · Vlny · O aplikaci), header with spot selector
  (persisted in `localStorage`, default `san-juan-canal`).
- `data.ts`: fetch `./data/forecast.json` on load, on tab focus and every 15 min.
  Expose `{ forecast, status }`. Show "data z 14:05" in the header; a warning
  chip when `generatedAt` is older than 3 h; a friendly full-page state when
  there is no data at all. A ticking `now` signal (1 min) drives "current" values.
- Light/dark via CSS custom properties; sea-themed but restrained; system font stack.
- Accessibility: stars have text equivalents, charts have a table alternative
  or `aria-label` summary, touch targets ≥ 44 px.

### Přehled (`#/`)
- **Teď** card: tide (↑ stoupá / ↓ klesá, current height, "příliv v 18:20 za 2 h 10 min"),
  current score stars for the spot, swell `2,4 m · 13 s · SZ`, wind, weather.
- **Kdy vyrazit** card: the best upcoming window in the next 3 days
  ("zítra 14–17 h ★★★★ – swell 3,2 m / 14 s od SZ, příliv 16:40"). If nothing
  reaches 2★: "V příštích dnech nic velkého."
- **Výhled** strip: 8 days, each with stars of its window and max swell height; tap → Vlny for that day.
- Safety banner when the window has ≥ 4★ or wave height ≥ 4 m:
  „Velké vlny jsou nebezpečné – držte se dál od hrany útesů a mokrých skal.“

### Příliv (`#/priliv`)
- SVG tide curve for the next 48 h (15-min series): now marker, labelled
  high/low points, night shading from sunrise/sunset, horizontal scroll or
  day switch for the remaining days.
- Table of extremes per day for 8 days (time, height, type), today highlighted.
- Daily range bar + label „velký rozsah (skočný příliv)“ / „malý rozsah (hluchý)“
  from relative range within the window.
- Heights shown as `levelMsl + datumOffsetM`, footnote: times ±30 min, model data, not for navigation.

### Vlny (`#/vlny`)
- Day selector (8 days). For the selected day:
  - summary line with the best window and Czech label;
  - hourly rows (daylight emphasised, night dimmed/collapsed): time, stars bar,
    swell height/period, direction arrow (rotated SVG, pointing where waves travel),
    wind speed/gust + arrow, weather icon, temp, rain, mini tide indicator;
  - small SVG charts over the day: swell height + period, score.
- Legend explaining the score in two sentences.

### O aplikaci
Sources and attribution links (Open-Meteo, CC BY 4.0), accuracy caveats,
how the score works, link to AEMET coastal warnings, app version/build date.

## 9. PWA

- `vite-plugin-pwa`, `registerType: 'autoUpdate'`, `generateSW`.
- Manifest: name „Baywatch – Santander“, short_name „Baywatch“, `lang: cs`,
  `display: standalone`, `start_url: './'`, `scope: './'`, theme/background colours,
  icons 192, 512 and 512 maskable (generate simple wave-glyph PNGs, commit them),
  plus `apple-touch-icon` and iOS meta tags in `index.html`.
- Precache the app shell. Runtime cache for `data/forecast.json`:
  `NetworkFirst`, 5 s network timeout, so the app opens offline with the last forecast.
- Manifest file name must be `manifest.webmanifest` (nginx has a rule for it).
- Acceptance: Lighthouse/Chrome DevTools reports the app as installable; with
  the network off the installed app opens and shows the last data with its age.

## 10. Milestones

- [ ] **M0 Scaffold** – package.json, tsconfig (strict), Vite + Preact, vitest, eslint,
      npm scripts of §3, placeholder page. `npm run check` and `npm run build`
      produce `dist/site/index.html` and `dist/fetcher/fetch.mjs`.
- [ ] **M1 Shared logic** – types, spots, tide, score, windows, format, geo with tests
      (incl. the reference points in §6).
- [ ] **M2 Fetcher** – live `npm run fetch` writes a valid `forecast.json`; fixture-based
      tests; failure leaves the old file. Compare two tide extremes with a published
      Santander tide table and note the difference in the PR/commit message.
- [ ] **M3 Shell** – routing, tab bar, spot selector, data loading, stale/empty states, theming.
- [ ] **M4 Příliv** page.
- [ ] **M5 Vlny** page.
- [ ] **M6 Přehled** page.
- [ ] **M7 PWA** – manifest, icons, service worker, offline check.
- [ ] **M8 Release** – `docker compose -f deploy/docker-compose.yml config` validates;
      local smoke test of the nginx config with the built site
      (`site/`, `data/`, `nginx/` laid out as on the server); README/DEPLOY updated
      for anything that changed. The user runs the actual deploy.

After completing each milestone, stage everything in git, ask a different model (Opus or
Sonnet) for review and let it implement the findings. Commit afterwards.

Check every page at 360 px width in both themes.

## 11. Later ideas (not in scope now)

- More accurate tides from an official source fetched server-side (Puertos del
  Estado / Instituto Hidrográfico de la Marina publish Santander predictions –
  API availability unverified) or harmonic constituents.
- Web-push or e-mail alert when a ≥ 4★ window appears.
- AEMET coastal warnings, webcam links, sea temperature / swimming page,
  sunset page, history of observed vs. forecast.
- Score calibration from the family's own ratings.
