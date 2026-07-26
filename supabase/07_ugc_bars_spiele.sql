-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – UGC-Architektur: Bars & Spielformen (v2.1)
--
-- Ausführen NACH 01_schema.sql und 06_konto_features.sql:
--   Supabase Dashboard → SQL Editor → New query → einfügen → RUN.
--
-- Das Skript ist idempotent (if not exists / drop policy if exists)
-- und ADDITIV: bestehende Tabellen (kneipen_vorlage, meine_kneipen,
-- meine_spielformen) bleiben unangetastet und dienen als Backup.
-- Die App liest nach dieser Migration nur noch aus `bars` + `spielformen`.
--
-- Kernideen
--   • EINE Tabelle `bars` als Single Source of Truth für alle Bars –
--     kuratierte wie nutzergenerierte. Unterschied nur über Spalten.
--   • Sichtbarkeit ist Datenzustand, nicht Tabellenzugehörigkeit:
--     'privat' (nur Ersteller + Mitspieler) vs 'oeffentlich' (global).
--   • Veröffentlichen ist ein bewusster UPDATE. INSERT erzwingt
--     per RLS 'privat' – damit können in Routen angelegte Bars
--     technisch nicht versehentlich öffentlich werden.
--   • Löschen ist gefahrlos: `tour_kneipen` speichert einen Snapshot
--     (Name/Koordinaten), laufende und vergangene Touren bleiben intakt.
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. Rollen & Rechte-Helfer
-- ════════════════════════════════════════════════════════════════
create table if not exists benutzer_rollen (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  rolle       text not null check (rolle in ('admin', 'moderator')),
  erstellt_am timestamptz default now()
);

alter table benutzer_rollen enable row level security;

-- Rollen werden ausschließlich hier im SQL-Editor vergeben (Service-Role
-- umgeht RLS). Clients dürfen nur ihre eigene Rolle lesen.
drop policy if exists "rollen_eigene_lesen" on benutzer_rollen;
create policy "rollen_eigene_lesen" on benutzer_rollen
  for select to authenticated
  using (user_id = auth.uid());

-- security definer: umgeht RLS auf benutzer_rollen und verhindert damit
-- Policy-Rekursion, wenn die Funktion in anderen Policies benutzt wird.
create or replace function ist_moderator()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from benutzer_rollen
    where user_id = auth.uid() and rolle in ('admin', 'moderator')
  );
$$;

create or replace function ist_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from benutzer_rollen
    where user_id = auth.uid() and rolle = 'admin'
  );
$$;

grant execute on function ist_moderator() to authenticated;
grant execute on function ist_admin() to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 2. bars – Single Source of Truth für alle Bars
-- ════════════════════════════════════════════════════════════════
create table if not exists bars (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  lat               double precision not null,
  lng               double precision not null,
  adresse           text,
  stadt_id          bigint references staedte(id) on delete set null,
  kategorie         text,                       -- bar | kneipe | cocktail | brauhaus
  notiz             text,
  -- NULL = kuratiert vom Team, sonst der/die Erstellende
  ersteller_user_id uuid references auth.users(id) on delete cascade,
  sichtbarkeit      text not null default 'privat'
                      check (sichtbarkeit in ('privat', 'oeffentlich')),
  -- nur Moderation darf sperren; gesperrte Bars sind global unsichtbar
  gesperrt          boolean not null default false,
  sortierung        int default 0,
  erstellt_am       timestamptz default now(),
  geaendert_am      timestamptz default now()
);

create index if not exists bars_stadt_idx      on bars (stadt_id);
create index if not exists bars_ersteller_idx  on bars (ersteller_user_id);
create index if not exists bars_sichtbar_idx   on bars (sichtbarkeit, gesperrt);

create or replace function bars_touch()
  returns trigger language plpgsql as $$
begin
  new.geaendert_am := now();
  return new;
end;
$$;

drop trigger if exists bars_touch_trg on bars;
create trigger bars_touch_trg before update on bars
  for each row execute function bars_touch();

-- ── Pro Nutzer ausgeblendete Bars (nur Anzeige, keine Löschung) ──
create table if not exists bar_ausblendungen (
  user_id uuid not null references auth.users(id) on delete cascade,
  bar_id  uuid not null references bars(id) on delete cascade,
  primary key (user_id, bar_id)
);

-- ── Meldungen als Grundlage für Moderation ──────────────────────
create table if not exists bar_meldungen (
  id          uuid primary key default gen_random_uuid(),
  bar_id      uuid not null references bars(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  grund       text,
  erstellt_am timestamptz default now(),
  unique (bar_id, user_id)
);


-- ════════════════════════════════════════════════════════════════
-- 3. spielformen erweitern (eigene Minigames dauerhaft)
-- ════════════════════════════════════════════════════════════════
alter table spielformen add column if not exists ersteller_user_id uuid references auth.users(id) on delete cascade;
alter table spielformen add column if not exists sichtbarkeit      text not null default 'oeffentlich';
alter table spielformen add column if not exists gesperrt          boolean not null default false;
alter table spielformen add column if not exists erstellt_am       timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'spielformen_sichtbarkeit_check'
  ) then
    alter table spielformen add constraint spielformen_sichtbarkeit_check
      check (sichtbarkeit in ('privat', 'oeffentlich'));
  end if;
end $$;

create index if not exists spielformen_ersteller_idx on spielformen (ersteller_user_id);

create table if not exists spielform_ausblendungen (
  user_id      uuid   not null references auth.users(id) on delete cascade,
  spielform_id bigint not null references spielformen(id) on delete cascade,
  primary key (user_id, spielform_id)
);


-- ════════════════════════════════════════════════════════════════
-- 4. Verknüpfungen für Session-Sichtbarkeit & Gameplay
-- ════════════════════════════════════════════════════════════════
-- bar_id macht aus dem Snapshot in der Route eine nachvollziehbare
-- Referenz: Mitspieler dürfen private Bars der Session lesen und sie
-- später in die eigene Liste übernehmen.
alter table tour_kneipen add column if not exists bar_id uuid references bars(id) on delete set null;
create index if not exists tour_kneipen_bar_idx on tour_kneipen (bar_id);

-- geraet_id: welches Gerät verwaltet diesen Teilnehmer (Pass-and-Play).
-- Grundlage für den automatischen Spielerwechsel im Minigame.
alter table teilnehmer add column if not exists geraet_id text;
create index if not exists teilnehmer_geraet_idx on teilnehmer (tour_id, geraet_id);


-- ════════════════════════════════════════════════════════════════
-- 5. Migration: bestehende Daten in `bars` überführen
-- ════════════════════════════════════════════════════════════════
-- 5a. Kuratierte Vorlagen (idempotent über name+stadt)
insert into bars (name, lat, lng, adresse, stadt_id, sichtbarkeit, sortierung, ersteller_user_id)
select v.name, v.lat, v.lng, v.adresse, v.stadt_id, 'oeffentlich', v.sortierung, null
from kneipen_vorlage v
where not exists (
  select 1 from bars b
  where b.name = v.name and b.stadt_id is not distinct from v.stadt_id
);

-- 5b. Persönliche Bars aus 06_konto_features.sql → privat
insert into bars (name, lat, lng, adresse, ersteller_user_id, sichtbarkeit)
select m.name, m.lat, m.lng, m.adresse, m.user_id, 'privat'
from meine_kneipen m
where not exists (
  select 1 from bars b
  where b.ersteller_user_id = m.user_id and b.name = m.name
);

-- 5c. Eigene Spielformen → spielformen (privat)
insert into spielformen (titel, beschreibung, schwierigkeit, ersteller_user_id, sichtbarkeit)
select s.titel, coalesce(s.beschreibung, ''), 1, s.user_id, 'privat'
from meine_spielformen s
where not exists (
  select 1 from spielformen sf
  where sf.ersteller_user_id = s.user_id and sf.titel = s.titel
);


-- ════════════════════════════════════════════════════════════════
-- 6. Row Level Security
--
--    Lesen   – öffentlich & nicht gesperrt | eigene | Session | Moderation
--    Anlegen – nur für sich selbst UND zwingend 'privat'
--    Ändern  – Ersteller (nicht gesperrt) | Moderation
--    Löschen – Ersteller | Moderation
-- ════════════════════════════════════════════════════════════════
alter table bars                    enable row level security;
alter table bar_ausblendungen       enable row level security;
alter table bar_meldungen           enable row level security;
alter table spielform_ausblendungen enable row level security;

-- ── bars ────────────────────────────────────────────────────────
drop policy if exists "bars_lesen"   on bars;
drop policy if exists "bars_neu"     on bars;
drop policy if exists "bars_aendern" on bars;
drop policy if exists "bars_loeschen" on bars;

create policy "bars_lesen" on bars
  for select to authenticated
  using (
    (sichtbarkeit = 'oeffentlich' and not gesperrt)
    or ersteller_user_id = auth.uid()
    or ist_moderator()
    -- Session-Ausnahme: private Bar einer Tour, in der ich mitspiele
    or exists (
      select 1
      from tour_kneipen tk
      join teilnehmer tn on tn.tour_id = tk.tour_id
      where tk.bar_id = bars.id and tn.user_id = auth.uid()
    )
  );

-- Veröffentlichen ist bewusst NICHT per INSERT möglich (Routen-Ausnahme).
create policy "bars_neu" on bars
  for insert to authenticated
  with check (
    ersteller_user_id = auth.uid()
    and sichtbarkeit = 'privat'
    and gesperrt = false
  );

-- Ersteller darf bearbeiten und veröffentlichen, aber nichts entsperren
-- und die Bar nicht an eine andere Person übertragen.
create policy "bars_aendern" on bars
  for update to authenticated
  using ((ersteller_user_id = auth.uid() and not gesperrt) or ist_moderator())
  with check (
    ist_moderator()
    or (ersteller_user_id = auth.uid() and gesperrt = false)
  );

create policy "bars_loeschen" on bars
  for delete to authenticated
  using (ersteller_user_id = auth.uid() or ist_moderator());

-- ── bar_ausblendungen (rein persönlich) ─────────────────────────
drop policy if exists "bar_ausbl_eigene" on bar_ausblendungen;
create policy "bar_ausbl_eigene" on bar_ausblendungen
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── bar_meldungen: melden darf jede:r, lesen nur Moderation ─────
drop policy if exists "bar_meld_neu"   on bar_meldungen;
drop policy if exists "bar_meld_lesen" on bar_meldungen;
create policy "bar_meld_neu" on bar_meldungen
  for insert to authenticated with check (user_id = auth.uid());
create policy "bar_meld_lesen" on bar_meldungen
  for select to authenticated using (user_id = auth.uid() or ist_moderator());

-- ── spielformen ─────────────────────────────────────────────────
drop policy if exists "spielform_lesen"    on spielformen;
drop policy if exists "spielform_neu"      on spielformen;
drop policy if exists "spielform_aendern"  on spielformen;
drop policy if exists "spielform_loeschen" on spielformen;

create policy "spielform_lesen" on spielformen
  for select to authenticated
  using (
    (sichtbarkeit = 'oeffentlich' and not gesperrt)
    or ersteller_user_id = auth.uid()
    or ist_moderator()
  );

create policy "spielform_neu" on spielformen
  for insert to authenticated
  with check (
    ersteller_user_id = auth.uid()
    and sichtbarkeit = 'privat'
    and gesperrt = false
  );

create policy "spielform_aendern" on spielformen
  for update to authenticated
  using ((ersteller_user_id = auth.uid() and not gesperrt) or ist_moderator())
  with check (ist_moderator() or (ersteller_user_id = auth.uid() and gesperrt = false));

create policy "spielform_loeschen" on spielformen
  for delete to authenticated
  using (ersteller_user_id = auth.uid() or ist_moderator());

-- ── spielform_ausblendungen ─────────────────────────────────────
drop policy if exists "sf_ausbl_eigene" on spielform_ausblendungen;
create policy "sf_ausbl_eigene" on spielform_ausblendungen
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- 7. Realtime (neue Bars erscheinen live bei Mitspielern)
-- ════════════════════════════════════════════════════════════════
do $$
begin
  begin
    alter publication supabase_realtime add table bars;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table tour_kneipen;
  exception when duplicate_object then null;
  end;
end $$;


-- ════════════════════════════════════════════════════════════════
-- 8. Admin-Rolle für dich selbst setzen (E-Mail anpassen!)
-- ════════════════════════════════════════════════════════════════
insert into benutzer_rollen (user_id, rolle)
select id, 'admin' from auth.users where email = 'lukasniessen05@gmail.com'
on conflict (user_id) do update set rolle = 'admin';


-- ════════════════════════════════════════════════════════════════
-- Nützliche Moderations-Abfragen (bei Bedarf einzeln ausführen)
-- ════════════════════════════════════════════════════════════════
-- Gemeldete Bars mit Anzahl:
--   select b.id, b.name, b.sichtbarkeit, count(m.id) as meldungen
--   from bars b join bar_meldungen m on m.bar_id = b.id
--   group by b.id order by meldungen desc;
--
-- Bar sperren (nur Moderation):
--   update bars set gesperrt = true where id = '…';
--
-- Community-Bar ins kuratierte Set übernehmen:
--   update bars set ersteller_user_id = null, sichtbarkeit = 'oeffentlich' where id = '…';
