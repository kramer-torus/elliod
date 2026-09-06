# Elliod

Personal hybrid-training app: keep running strong after a marathon, get
stronger with a shoulder/posture emphasis, and lean out. Single user, no
backend, installable on a phone as a PWA, works offline.

The training rationale is in [PLAN.md](PLAN.md) and in the app's Guide tab.

## What it does

- Generates a 14-week calendar (recovery → foundation → build → consolidate)
  from your height, weight, age, marathon time and start date.
- Running paces (easy, marathon, threshold, interval, reps) and race
  predictions from the Daniels VDOT model.
- Three strength templates (Upper A, Lower A/B, Upper B) whose sets, reps and
  RPE scale with the phase, with deload weeks.
- Session logging: sets × reps × kg for lifts, distance/time/RPE for runs.
- Double-progression suggestions: hit the top of the rep range on every set
  and the next session suggests more weight.
- Morning-weight log with 7-day average, weekly trend and calorie-adjustment
  nudges; phase-aware calorie and macro targets.
- Progress charts: bodyweight vs target, planned vs actual weekly km, top-set
  and estimated 1RM per lift, adherence.
- Export/import of all data as JSON. Everything lives in `localStorage`.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the plan, paces, progression, nutrition
npm run build      # static site in dist/
npm run preview    # serve dist/ on http://localhost:4173
```

## Deploy

`.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/`
to the `gh-pages` branch on every push to `main` (or on manual dispatch).
GitHub Pages serves that branch at https://kramer-torus.github.io/elliod/.
If the site 404s, enable it once: repo **Settings → Pages → Source: Deploy
from a branch → `gh-pages` / root**.

On the phone, open the URL and use "Add to Home Screen" (iOS Safari: Share
menu; Android Chrome: menu → Install app). It runs offline after that.

Browser smoke test (needs a Chromium binary; run `npm run preview` first):

```sh
CHROME_PATH=/path/to/chrome npm run smoke
```

## Layout

```
src/lib/vdot.ts         VDOT paces and race predictions
src/lib/plan.ts         phases, weekly template, run and lift prescriptions
src/lib/exercises.ts    exercise library with cues, alternatives, increments
src/lib/progression.ts  double progression, e1RM, weight trend, adherence
src/lib/nutrition.ts    maintenance, targets, trend-based adjustment
src/lib/storage.ts      localStorage persistence, export/import
src/components/         Today, Plan, Session, Progress, Guide, Settings
src/test/               vitest suites
scripts/smoke.mjs       Playwright walkthrough of every screen
```
