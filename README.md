# Baywatch

Small public PWA about the ocean around Santander (Cantabria): tides and a
wave-watching forecast ("when is it worth going to the cliffs?"). UI is in Czech.

- **Frontend**: Vite + Preact + TypeScript, installable PWA, static files only.
- **Fetcher**: a Node script run hourly by cron on the server; downloads
  Open-Meteo data, computes tide extremes and a wave-show score, and writes
  `data/forecast.json` that the frontend reads.
- **Hosting**: Oracle Cloud VM, nginx in Docker behind a Cloudflare Tunnel.

No accounts, no secrets in the repo, no user data.

## Docs

- [`docs/PLAN.md`](docs/PLAN.md) – implementation plan (milestones, data schema, scoring).
- [`docs/DEPLOY.md`](docs/DEPLOY.md) – návod na publikaci (česky).
- [`CLAUDE.md`](CLAUDE.md) – conventions for coding agents.

## Development

```bash
npm install
npm run fetch     # writes public/data/forecast.json from live Open-Meteo data
npm run dev       # http://localhost:5173
npm run check     # typecheck + lint + tests
npm run build     # dist/site (frontend) + dist/fetcher/fetch.mjs
./scripts/deploy.sh
```

## Data & attribution

Weather and marine data by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0,
non-commercial free tier). Tide times derive from a global ~8 km model and are
approximate – not for navigation.
