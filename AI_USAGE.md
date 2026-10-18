# AI usage log

The Congressional App Challenge asks entrants to disclose AI use. This file records what AI helped with and what I wrote myself.

**Tool:** Claude Code (Anthropic), used as a coding assistant.

## What I write myself

- `src/lib/feasibility.ts` + tests: the time math and Easy / Tight / Hidden rules
- `src/lib/voting.ts` + tests: Borda count, veto, repeat penalty, tie-breaks
- Product idea, feature decisions, testing with my lunch group, demo video, submission answers

## What AI assisted with

| Date | What | Notes |
| --- | --- | --- |
| 2026-10-18 | Project scaffold (Vite/React/TS/Tailwind), visual design system, Home screen, app shell + page transitions | Reviewed and tested on desktop + phone width |
| 2026-10-18 | Supabase schema + Row Level Security policies (`supabase/schema.sql`) | Read-and-insert for everyone, no deletes, column-limited updates |
| 2026-10-18 | `/api/matrix` serverless proxy for OpenRouteService | Keeps the API key on the server |
| 2026-10-18 | Room-code helper + tests (`src/lib/codes.ts`) | |

<!-- Add a row each day. -->
