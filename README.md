# LunchRun

**A free tool that helps a group of students agree on where to eat for off-campus lunch, showing only places they can get to, eat at, and get back from before lunch ends.**

Live: https://lunch-run-rose.vercel.app · Built for the 2026 Congressional App Challenge.

## How it works

1. **Host sets up.** One person taps *Start a lunch*, picks where they're leaving from (GPS or a school/address search), how long lunch is, and walking or driving. A code + QR code are shown right away so friends can join while the host adjusts settings.
2. **LunchRun filters.** It finds every nearby restaurant, café, fast-food place and food court, gets real travel times, and hides anything that won't fit:

   ```
   total = travel there + order wait + eat + travel back + safety buffer (+ 3 min parking if driving)
   Easy  → total ≤ lunch − 5 min      Tight → total ≤ lunch      otherwise hidden
   ```
   Order wait depends on the place type (fast food/café 5 min, food court 8, sit-down 15).
3. **Everyone votes.** Friends scan the QR code and rank their top 3 on their own phones, with one "No way" veto each. The ballot can be searched, sorted (quickest / closest / A–Z) and filtered by type or cuisine. Votes sync live.
4. **A fair winner.** Ranked-choice (Borda) points: 1st = 3, 2nd = 2, 3rd = 1. A place vetoed by more than ⅓ of the group is out. Places the group went to in its last 3 lunches get −2 so you don't go to the same place every day. Ties go to Easy over Tight, then the shorter trip, then a coin flip that every phone computes the same way. The full scoring table is shown on the results screen.
5. **Go.** The results screen shows the winner, a "Leave by" time, Google/Apple Maps directions, and a live lunch clock that counts down each step of the trip until the bell.

## The hard parts (and how they were solved)

- **Unreliable free map data.** Public OpenStreetMap servers (Overpass) were often down or rate-limited. The `/api/places` serverless function asks several sources at once: Overpass when it's up (complete data), otherwise Geoapify merged with an adaptive Nominatim search that splits the area into smaller tiles whenever results are cut off. Results are cached at the edge for 24 hours, rounded to ~100 m so GPS jitter still hits the cache.
- **Travel times under API limits.** The OpenRouteService key stays on the server (`/api/matrix`). Requests are batched 50 places at a time. When the walking service was down, the function falls back to street distances from the driving network at walking pace (capped at straight-line × 1.3 to ignore one-way loops), and the UI marks those times with "≈".
- **Fair, consistent results on every phone.** Scoring is a pure function (`src/lib/voting.ts`) run on each device. The random tie-break is seeded with the round id, and the repeat penalty only counts lunches before this one, so everyone sees the same winner and breakdown.
- **Live sync without a custom server.** Supabase Realtime pushes member/vote/round changes; Supabase Presence shows who has joined before the vote even exists. If two phones decide at once, a guarded update means only one winner is saved.
- **Surviving deploys.** If the app is updated while someone has it open, code-split screens reload once instead of showing a blank page, and an error boundary shows a friendly "Reload" screen.

## Tech

| Part | Tool |
| --- | --- |
| App | Vite, React 19, TypeScript, Tailwind CSS v4, Motion |
| Map | Leaflet + OpenStreetMap tiles |
| Realtime + database | Supabase (Postgres, Row Level Security, Realtime, Presence) |
| Restaurant data | OpenStreetMap via Overpass, Geoapify Places, Nominatim |
| Travel times | OpenRouteService Matrix API |
| Address search | Photon (komoot), Nominatim |
| Hosting + API functions | Vercel |
| Tests | Vitest (feasibility, voting, ballot filters, history, live clock) |

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key (others optional)
npm run dev                  # also serves the /api functions locally
```

`npm test` runs the unit tests. `npm run build` type-checks and builds.

## One-time setup

**Supabase:** create a free project → SQL Editor → run [`supabase/schema.sql`](supabase/schema.sql) (for an existing project, also run the files in `supabase/migrations/`) → copy the Project URL and the publishable/anon key.

**Vercel:** import this repo (Vite is auto-detected) and add these environment variables:

| Variable | Type | What for |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Config | Supabase project URL (public) |
| `VITE_SUPABASE_ANON_KEY` | Config | Supabase publishable key (public; RLS protects data) |
| `ORS_API_KEY` | Secret | OpenRouteService travel times |
| `GEOAPIFY_API_KEY` | Secret | Restaurant data (recommended) |

Every push to `main` redeploys.

## Project layout

```
src/lib/          core logic: feasibility, voting, ballot filters, history, data fetching, Supabase
src/pages/        Home, CreateRound (host), CrewHub (waiting room), Round (vote + results)
src/components/   UI: PlaceCard, VoteView, ResultsView, LiveLunchClock, MapView, ...
api/places.ts     restaurant-data proxy with fallbacks + 24h cache
api/matrix.ts     travel-time proxy that holds the ORS key
supabase/         database schema, security policies, migrations
scripts/          icon / link-preview generator
```

## Known limits (2.0 ideas)

- No accounts, so security is deliberately simple: data is read/insert-only from the browser with no deletes, but someone with a round's link could change its winner.
- When routing services are down, walking times are estimates (shown with "≈").
- The first search in a brand-new area can take ~30 s; after that it's cached.
- 2.0: live wait times, rating places after lunch, school-wide groups, real routes on the map.

## Credits

Map data © OpenStreetMap contributors. Routing by OpenRouteService. Places by Geoapify. Search by Photon and Nominatim.
See [AI_USAGE.md](AI_USAGE.md) for how AI tools were used.
