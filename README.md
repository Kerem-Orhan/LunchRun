# LunchRun

**Agree on off-campus lunch in seconds — and only see places you can actually get to, eat at, and get back from before the bell.**

Built for the 2026 Congressional App Challenge.

## How it works

1. Someone starts a **crew** (e.g. "5th period lunch") and shares the code / QR.
2. They set today's rules: start location, lunch length, walking or driving.
3. LunchRun finds nearby food (OpenStreetMap), gets real travel times (OpenRouteService), and hides anything that won't fit:
   `travel there + wait + eat + travel back + buffer (+ parking)` must fit in the lunch period.
4. Everyone ranks a top 3 and can veto one place — live on their own phones.
5. A ranked-choice (Borda) count picks the winner, with the scoring shown on screen, plus a "Leave by" time.

## Tech

| Part | Tool |
| --- | --- |
| App | Vite, React, TypeScript, Tailwind CSS, Motion |
| Map | Leaflet + OpenStreetMap tiles |
| Realtime + DB | Supabase (Postgres + Realtime) |
| Restaurant data | OpenStreetMap Overpass API |
| Travel times | OpenRouteService Matrix API (via `/api/matrix` serverless proxy) |
| Address search | Nominatim |
| Hosting | Vercel |
| Tests | Vitest |

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

`npm test` runs the unit tests. `npm run build` type-checks and builds.

## One-time setup

**Supabase**
1. Create a free project at supabase.com.
2. SQL Editor → paste [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. Project Settings → API → copy the Project URL and `anon` public key into `.env.local` (and into Vercel).

**OpenRouteService**
1. Get a free key at openrouteservice.org.
2. Add it to Vercel as `ORS_API_KEY` (server-only — never prefix it with `VITE_`).

**Geoapify (recommended — reliable restaurant data)**
1. Free account at geoapify.com → create a project → copy the API key.
2. Add it to Vercel as `GEOAPIFY_API_KEY` (Secret). Without it, the app falls back to public Overpass / Nominatim servers, which are often busy.

**Vercel**
1. Import this GitHub repo at vercel.com/new (framework: Vite — auto-detected).
2. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ORS_API_KEY`, `GEOAPIFY_API_KEY`.
3. Every push to `main` redeploys.

## Project layout

```
src/lib/        core logic (feasibility, voting, data fetching, Supabase client)
src/pages/      one file per screen
src/components/ reusable UI (LunchClock, CodeInput, Button, ...)
api/matrix.ts   serverless proxy that holds the ORS key
supabase/       database schema + security policies
```

## Credits

Map data © OpenStreetMap contributors. Routing by OpenRouteService. Geocoding by Nominatim.
See [AI_USAGE.md](AI_USAGE.md) for how AI tools were used.
