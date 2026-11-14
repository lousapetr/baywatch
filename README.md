# Baywatch

Small public PWA about the ocean around Santander (Cantabria): tides and a
wave-watching forecast ("when is it worth going to the cliffs?"). The UI is in Czech.

## What it does

Pages (hash routes, one set of data for all of them):

- **Přehled** – current tide state, best upcoming wave-watching window, 8-day outlook, all spots at a glance.
- **Příliv** – tide chart, high/low table with times and heights, range bars.
- **Vlny** – day selector, hourly swell/wind rows, swell and score charts, safety banner.
- **Počasí** – shore weather per day (temperature, rain, cloud, wind, sunrise/sunset).
- **O aplikaci** – method, caveats, data attribution.

Installable as a PWA; offline it shows the last downloaded forecast with its age.
No accounts, no secrets in the repo, no user data; `localStorage` holds UI preferences only.

## Stack

- Frontend: Vite + Preact + TypeScript, `vite-plugin-pwa`, hand-written SVG charts. Static files only.
- Fetcher: dependency-free Node 22 script (global `fetch`), bundled by esbuild into one file.
- Shared pure logic (`src/shared`): types, tide extremes, scoring, formatting; covered by vitest.
- Hosting: Oracle Cloud VM, nginx in Docker behind a Cloudflare Tunnel.

## Data flow

```
cron (hourly) ─► fetcher ─► data/forecast.json + data/status.json
phone ─► Cloudflare Tunnel ─► nginx ─► static site, reads ./data/forecast.json
```

The fetcher downloads Open-Meteo marine and weather data, computes tide
extremes and the wave-show score, and writes the ready-to-render
`forecast.json` atomically (a failed run leaves the old file). `status.json`
counts consecutive failures; the app warns after 3. The frontend never calls
third-party APIs.

## Development

```bash
npm install
npm run fetch     # writes src/web/public/data/forecast.json from live Open-Meteo data
npm run dev       # http://localhost:5173
npm run check     # typecheck + lint + tests
npm run build     # dist/site (frontend) + dist/fetcher/fetch.mjs
```

| script | does |
| --- | --- |
| `dev` | Vite dev server |
| `fetch` | run the fetcher into `src/web/public/data/` (gitignored). Behind an HTTP proxy prefix it with `NODE_USE_ENV_PROXY=1`; otherwise not needed |
| `build` | Vite build into `dist/site` (without `data/`) and esbuild bundle `dist/fetcher/fetch.mjs` |
| `test`, `lint`, `typecheck` | vitest, eslint, `tsc --noEmit` |
| `check` | typecheck + lint + test (must pass before a milestone is done) |

## Repo layout

```
src/shared/    pure logic shared by fetcher and frontend (+ tests)
src/fetcher/   Open-Meteo client, forecast assembly, status file, fixtures
src/web/       Preact app (pages/, components/), public/ (icons, dev data)
deploy/        docker-compose.yml and nginx config copied to the server
scripts/       deploy.sh (laptop-side deploy), smoke.sh (nginx smoke test)
docs/          PLAN.md, DEPLOY.md
```

## Deploy and smoke test

Full guide (Czech): [`docs/DEPLOY.md`](docs/DEPLOY.md). Short version:

```bash
./scripts/deploy.sh   # check + build + rsync + docker compose up (config in .env.deploy)
./scripts/smoke.sh    # needs docker: runs deploy/nginx in nginx:alpine on the built site and asserts headers/status codes
```

## Docs

- [`docs/PLAN.md`](docs/PLAN.md) – implementation plan (milestones, data schema, scoring).
- [`docs/DEPLOY.md`](docs/DEPLOY.md) – deployment guide (Czech).
- [`CLAUDE.md`](CLAUDE.md) – conventions for coding agents.

## Data & attribution

Weather and marine data by [Open-Meteo](https://open-meteo.com/), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (free tier is
non-commercial). Tide times derive from a global ~8 km model, are accurate to
about ±30 min and are not for navigation.
