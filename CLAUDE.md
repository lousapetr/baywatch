# Baywatch – agent notes

Read `docs/PLAN.md` before implementing anything; work milestone by milestone
and tick the checkboxes there as you finish them.

## Stack & layout

- One npm package, Node 22, TypeScript strict, ESM.
- `src/shared/` – pure, framework-free logic (types, tide extremes, scoring, formatting). Used by both sides. Everything here has vitest tests.
- `src/fetcher/` – Node script (no runtime deps, global `fetch`), bundled by esbuild into `dist/fetcher/fetch.mjs`.
- `src/web/` – Vite + Preact app, built into `dist/site/`. PWA via `vite-plugin-pwa`.
- `deploy/` – files copied to the server (compose, nginx). `scripts/deploy.sh` – laptop-side deploy.

## Rules

- UI text is Czech; code, identifiers, comments and commit messages are English.
- Comments are very concise and describe the current implementation only.
- All timestamps are unix seconds (UTC) in data; format for display with `Intl` in `Europe/Madrid`, never the device timezone.
- The frontend never calls third-party APIs; it only reads `data/forecast.json` (relative URL).
- All asset/data URLs are relative (`base: './'`) so the site works under any host or path.
- No secrets, analytics, cookies or user accounts. `localStorage` only for UI preferences.
- Keep dependencies minimal: preact, vite, vite-plugin-pwa, vitest, esbuild, typescript, eslint. Charts are hand-written SVG components – no chart library.
- Mobile-first: design for a 360 px wide phone, support light and dark (`prefers-color-scheme`).
- Don't change `deploy/` or `scripts/deploy.sh` without also updating `docs/DEPLOY.md`.
- `npm run check` must pass before a milestone is considered done.
- Verify API behaviour against the live API or docs rather than assuming; facts already verified are listed in `docs/PLAN.md` §2.
