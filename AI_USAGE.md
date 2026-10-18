# AI usage log

The Congressional App Challenge asks entrants to disclose AI use. This file records what AI helped with and what I wrote myself.

**Tool:** Claude Code (Anthropic), used as a coding assistant.

## What I did myself

- Product idea and feature design: the feasibility formula, wait times, Easy/Tight thresholds, and the voting rules (Borda, 1/3 veto, repeat penalty, tie-break order)
- Reviewing the code, testing with my lunch group, demo video, submission answers

## What AI assisted with

| Date | What | Notes |
| --- | --- | --- |
| 2026-10-18 | Project scaffold (Vite/React/TS/Tailwind), visual design system, Home screen, app shell + page transitions | Reviewed and tested on desktop + phone width |
| 2026-10-18 | Supabase schema + Row Level Security policies (`supabase/schema.sql`) | Read-and-insert for everyone, no deletes, column-limited updates |
| 2026-10-18 | `/api/matrix` serverless proxy for OpenRouteService | Keeps the API key on the server |
| 2026-10-18 | Room-code helper + tests (`src/lib/codes.ts`) | |
| 2026-10-18 | `src/lib/feasibility.ts` + tests: implements my time formula and Easy/Tight/Hidden rules, "leave by" time, distance pre-filter | 17 tests |
| 2026-10-18 | `src/lib/voting.ts` + tests: implements my Borda / veto / repeat-penalty / tie-break rules, returns the full scoring table | 16 tests |

| 2026-10-18 | Debugged OpenRouteService (walking service down, driving fine) and Overpass outages; added fallbacks | Walking falls back to street distance at walking pace, then straight-line estimate |
| 2026-10-18 | `overpass.ts`, `routing.ts`, `places.ts` + tests, `MapView` component | |

| 2026-10-18 | Full app build: Supabase data layer + realtime, crew hub, create-lunch screen, live voting, results, history; `/api/places` proxy with Nominatim fallback | Tested end to end in the browser, incl. a simulated 2-person vote (realtime + repeat penalty verified) |

| 2026-10-18 | Simplified flow (no crew setup, host screen with code/QR + live presence); fixed missing places (Willowbrook Mall) by merging Geoapify with an adaptive Nominatim crawl | 43 places found around the mall vs 0 before |

<!-- Add a row each day. -->
