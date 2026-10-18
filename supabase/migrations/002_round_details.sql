-- Migration 002: extra round/place details.
-- Run once in Supabase → SQL Editor (safe to re-run).

-- When lunch actually starts (for the "Leave by" time) and which device created the round
-- (that device gets the "Decide" button).
alter table public.rounds add column if not exists lunch_starts_at timestamptz;
alter table public.rounds add column if not exists creator_client_id uuid;
-- True when travel times are estimates (routing service was down) — the UI shows "≈".
alter table public.rounds add column if not exists estimated boolean not null default false;

-- Display details for place cards.
alter table public.places add column if not exists cuisine text;
alter table public.places add column if not exists distance_meters int;
