-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Konto-Features (v2.0)
-- Ausführen NACH schema.sql: Supabase Dashboard → SQL Editor → RUN.
--
-- Neu:
--   • meine_kneipen     – selbst angelegte Bars dauerhaft am Konto,
--                         in jeder neuen Tour sofort auswählbar
--   • meine_spielformen – eigene Spielformen dauerhaft am Konto
--                         (nicht pro Tour neu tippen)
-- RLS: strikt privat – jede:r sieht/verwaltet nur die eigenen Einträge.
-- ════════════════════════════════════════════════════════════════

create table if not exists meine_kneipen (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  adresse     text,
  erstellt_am timestamptz default now()
);

create table if not exists meine_spielformen (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  titel        text not null,
  beschreibung text default '',
  erstellt_am  timestamptz default now()
);

create index if not exists meine_kneipen_user_idx     on meine_kneipen (user_id);
create index if not exists meine_spielformen_user_idx on meine_spielformen (user_id);

alter table meine_kneipen     enable row level security;
alter table meine_spielformen enable row level security;

drop policy if exists "mk_eigene" on meine_kneipen;
create policy "mk_eigene" on meine_kneipen
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "msf_eigene" on meine_spielformen;
create policy "msf_eigene" on meine_spielformen
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
