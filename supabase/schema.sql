-- LunchRun database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Security model (no logins): the browser uses the public "anon" key, so
-- Row Level Security is what protects the data.
--   * Anyone can READ and INSERT (you need the crew code / round id to find anything useful).
--   * Nobody can DELETE from the browser — there are no delete policies.
--   * UPDATE is allowed only on the specific columns that must change
--     (column-level grants below), e.g. a round's status/winner or your own vote.
-- Honest limitation: with select open, someone with the anon key could list
-- rows. We store no personal data beyond display names, so that's acceptable
-- for this MVP; real auth would be a 2.0 feature.

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------- Tables ----------

create table public.crews (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  name        text not null check (char_length(name) between 1 and 32),
  created_at  timestamptz not null default now()
);

create table public.rounds (
  id               uuid primary key default gen_random_uuid(),
  crew_id          uuid not null references public.crews(id),
  start_lat        double precision not null check (start_lat between -90 and 90),
  start_lng        double precision not null check (start_lng between -180 and 180),
  lunch_minutes    int not null check (lunch_minutes between 10 and 120),
  mode             text not null check (mode in ('walking', 'driving')),
  eat_minutes      int not null default 15 check (eat_minutes between 0 and 60),
  buffer_minutes   int not null default 5 check (buffer_minutes between 0 and 30),
  status           text not null default 'voting' check (status in ('voting', 'decided')),
  winner_place_id  uuid, -- FK added below (places references rounds)
  lunch_starts_at    timestamptz,          -- for the "Leave by" time
  creator_client_id  uuid,                 -- device that gets the "Decide" button
  estimated          boolean not null default false, -- travel times are estimates
  created_at       timestamptz not null default now()
);

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references public.rounds(id),
  display_name  text not null check (char_length(display_name) between 1 and 24),
  client_id     uuid not null, -- per-device id from localStorage
  joined_at     timestamptz not null default now(),
  unique (round_id, client_id) -- rejoining doesn't duplicate you
);

create table public.places (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references public.rounds(id),
  osm_id          text not null,
  name            text not null,
  type            text not null check (type in ('restaurant', 'fast_food', 'cafe', 'food_court')),
  lat             double precision not null,
  lng             double precision not null,
  travel_minutes  numeric(5, 1) not null,
  total_minutes   numeric(5, 1) not null,
  status          text not null check (status in ('easy', 'tight')), -- 'hidden' places are never stored
  diet_tags       jsonb not null default '[]'::jsonb,
  cuisine         text,
  distance_meters int,
  price_tag       text check (price_tag in ('$', '$$', '$$$')),
  unique (round_id, osm_id)
);

alter table public.rounds
  add constraint rounds_winner_fk foreign key (winner_place_id) references public.places(id);

create table public.votes (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references public.rounds(id),
  member_id        uuid not null references public.members(id),
  first_place_id   uuid references public.places(id),
  second_place_id  uuid references public.places(id),
  third_place_id   uuid references public.places(id),
  veto_place_id    uuid references public.places(id),
  created_at       timestamptz not null default now(),
  -- One ballot per person. To change a vote, UPDATE the four pick columns
  -- (not a PostgREST upsert — that would try to update round_id/member_id too, which isn't granted).
  unique (round_id, member_id)
);

create table public.visits (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references public.crews(id),
  osm_id      text not null,
  name        text not null,
  visited_at  timestamptz not null default now()
);

-- Indexes for the lookups the app actually does.
create index on public.rounds  (crew_id, created_at desc);
create index on public.members (round_id);
create index on public.places  (round_id);
create index on public.votes   (round_id);
create index on public.visits  (crew_id, visited_at desc);

-- ---------- Row Level Security ----------

alter table public.crews   enable row level security;
alter table public.rounds  enable row level security;
alter table public.members enable row level security;
alter table public.places  enable row level security;
alter table public.votes   enable row level security;
alter table public.visits  enable row level security;

-- Read + insert for everyone, on every table.
do $$
declare t text;
begin
  foreach t in array array['crews', 'rounds', 'members', 'places', 'votes', 'visits'] loop
    execute format('create policy "read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('create policy "insert %1$s" on public.%1$I for insert to anon, authenticated with check (true)', t);
  end loop;
end $$;

-- Updates: only these tables, and (via grants) only these columns.
create policy "update rounds" on public.rounds for update to anon, authenticated using (true) with check (true);
create policy "update places" on public.places for update to anon, authenticated using (true) with check (true);
create policy "update votes"  on public.votes  for update to anon, authenticated using (true) with check (true);

revoke update, delete, truncate on all tables in schema public from anon, authenticated;
grant update (status, winner_place_id) on public.rounds to anon, authenticated;
grant update (price_tag)               on public.places to anon, authenticated;
grant update (first_place_id, second_place_id, third_place_id, veto_place_id) on public.votes to anon, authenticated;

-- ---------- Realtime ----------
-- Lobby (members), live voting (votes) and "decided" (rounds) push updates to every phone.
alter publication supabase_realtime add table public.members, public.votes, public.rounds, public.places;
