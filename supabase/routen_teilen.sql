-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Routen: speichern, veröffentlichen, teilen (v2.2)
--
-- Ausführen NACH ugc_bars_spiele.sql:
--   Supabase Dashboard → SQL Editor → New query → einfügen → RUN.
--
-- Das Skript ist idempotent (if not exists / drop policy if exists)
-- und additiv – es verändert keine bestehenden Daten.
--
-- Kernideen
--   • Eine Route ist eine benannte, geordnete Liste von Stops. Sie ist
--     Vorlage, nicht Spiel: `touren` bleiben unverändert und unabhängig.
--   • Sichtbarkeit funktioniert exakt wie bei Bars und Spielformen:
--     'privat' vs 'oeffentlich', Veröffentlichen ist ein bewusstes UPDATE.
--   • Teilen läuft über einen unrat­baren Token im Link. Der Token steht
--     bewusst NICHT in einer RLS-Policy (Policies können den Link nicht
--     kennen) – Vorschau und Übernahme laufen über zwei `security
--     definer`-Funktionen, die genau so viel freigeben wie nötig.
--   • Routennamen sind pro Nutzer eindeutig (unique index). Wer eine
--     Route mit belegtem Namen übernimmt, muss umbenennen – die Datenbank
--     erzwingt das, die App schlägt einen freien Namen vor.
--   • Beim Übernehmen bleiben öffentliche Bars referenziert; private Bars
--     der sendenden Person werden als eigene, private Kopie angelegt und
--     mit `herkunft = 'uebernommen'` gekennzeichnet.
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. Import-Kennzeichnung an Bars
-- ════════════════════════════════════════════════════════════════
-- `herkunft` überlebt das Löschen der Ursprungsbar und trägt deshalb das
-- Symbol in der UI. `quelle_bar_id` ist die weiche Referenz für Statistik
-- und für die Wiedererkennung beim mehrfachen Übernehmen.
alter table bars add column if not exists herkunft text not null default 'eigen';
alter table bars add column if not exists quelle_bar_id uuid references bars(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bars_herkunft_check') then
    alter table bars add constraint bars_herkunft_check
      check (herkunft in ('eigen', 'uebernommen'));
  end if;
end $$;

-- Eine übernommene Bar soll nicht doppelt entstehen, wenn dieselbe Route
-- zweimal gespeichert wird.
create unique index if not exists bars_quelle_pro_user
  on bars (ersteller_user_id, quelle_bar_id)
  where quelle_bar_id is not null;


-- ════════════════════════════════════════════════════════════════
-- 2. routen + routen_stops
-- ════════════════════════════════════════════════════════════════
create or replace function neuer_routen_token()
  returns text
  language sql
  volatile
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
$$;

create table if not exists routen (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  beschreibung      text,
  stadt_id          bigint references staedte(id) on delete set null,
  ersteller_user_id uuid not null references auth.users(id) on delete cascade,
  sichtbarkeit      text not null default 'privat'
                      check (sichtbarkeit in ('privat', 'oeffentlich')),
  gesperrt          boolean not null default false,
  -- Link-Geheimnis: wer den Token hat, darf Vorschau + Übernahme
  teilen_token      text not null unique default neuer_routen_token(),
  -- Woher stammt diese Route, falls übernommen? (weiche Referenz)
  quelle_route_id   uuid references routen(id) on delete set null,
  erstellt_am       timestamptz default now(),
  geaendert_am      timestamptz default now()
);

-- „Routennamen dürfen pro Spieler nur einmal vergeben werden."
-- Gross-/Kleinschreibung zählt dabei nicht als Unterschied.
create unique index if not exists routen_name_pro_user
  on routen (ersteller_user_id, lower(name));

create index if not exists routen_sichtbar_idx on routen (sichtbarkeit, gesperrt);
create index if not exists routen_stadt_idx    on routen (stadt_id);

create or replace function routen_touch()
  returns trigger language plpgsql as $$
begin
  new.geaendert_am := now();
  return new;
end;
$$;

drop trigger if exists routen_touch_trg on routen;
create trigger routen_touch_trg before update on routen
  for each row execute function routen_touch();

-- Stops sind – wie in `tour_kneipen` – Snapshot UND Referenz:
-- der Snapshot macht das Löschen einer Bar gefahrlos, die Referenz
-- erlaubt später „Bar in meine Liste übernehmen".
create table if not exists routen_stops (
  id        uuid primary key default gen_random_uuid(),
  route_id  uuid not null references routen(id) on delete cascade,
  bar_id    uuid references bars(id) on delete set null,
  name      text not null,
  lat       double precision not null,
  lng       double precision not null,
  adresse   text,
  position  int not null,
  unique (route_id, position)
);

create index if not exists routen_stops_route_idx on routen_stops (route_id, position);

-- Aus welcher Route ist diese Tour entstanden? Weiche Referenz: Wird die
-- Route gelöscht, bleibt die Tour vollständig (Stops sind Snapshots), nur
-- die Herkunft geht verloren. Grundlage für „Nochmal spielen" im Hauptmenü –
-- dort zählt, was wirklich gespielt wurde, nicht was angelegt wurde.
alter table touren add column if not exists route_id uuid references routen(id) on delete set null;
create index if not exists touren_route_idx on touren (host_user_id, route_id, erstellt_am desc);


-- ════════════════════════════════════════════════════════════════
-- 3. Row Level Security
--
--    Lesen   – öffentlich & nicht gesperrt | eigene | Moderation
--              (Link-Zugriff läuft über die RPCs in Abschnitt 4)
--    Anlegen – nur für sich selbst UND zwingend 'privat'
--    Ändern  – Ersteller (nicht gesperrt) | Moderation
--    Löschen – Ersteller | Moderation
-- ════════════════════════════════════════════════════════════════
alter table routen       enable row level security;
alter table routen_stops enable row level security;

drop policy if exists "routen_lesen"    on routen;
drop policy if exists "routen_neu"      on routen;
drop policy if exists "routen_aendern"  on routen;
drop policy if exists "routen_loeschen" on routen;

create policy "routen_lesen" on routen
  for select to authenticated
  using (
    (sichtbarkeit = 'oeffentlich' and not gesperrt)
    or ersteller_user_id = auth.uid()
    or ist_moderator()
  );

-- Wie bei Bars: veröffentlichen ist nie ein INSERT, sondern ein bewusstes
-- UPDATE aus dem Menüpunkt „Routen".
create policy "routen_neu" on routen
  for insert to authenticated
  with check (
    ersteller_user_id = auth.uid()
    and sichtbarkeit = 'privat'
    and gesperrt = false
  );

create policy "routen_aendern" on routen
  for update to authenticated
  using ((ersteller_user_id = auth.uid() and not gesperrt) or ist_moderator())
  with check (ist_moderator() or (ersteller_user_id = auth.uid() and gesperrt = false));

create policy "routen_loeschen" on routen
  for delete to authenticated
  using (ersteller_user_id = auth.uid() or ist_moderator());

-- ── routen_stops folgen immer der Route ─────────────────────────
drop policy if exists "routen_stops_lesen"   on routen_stops;
drop policy if exists "routen_stops_pflegen" on routen_stops;

create policy "routen_stops_lesen" on routen_stops
  for select to authenticated
  using (exists (
    select 1 from routen r
    where r.id = routen_stops.route_id
      and (
        (r.sichtbarkeit = 'oeffentlich' and not r.gesperrt)
        or r.ersteller_user_id = auth.uid()
        or ist_moderator()
      )
  ));

create policy "routen_stops_pflegen" on routen_stops
  for all to authenticated
  using (exists (
    select 1 from routen r
    where r.id = routen_stops.route_id
      and ((r.ersteller_user_id = auth.uid() and not r.gesperrt) or ist_moderator())
  ))
  with check (exists (
    select 1 from routen r
    where r.id = routen_stops.route_id
      and ((r.ersteller_user_id = auth.uid() and not r.gesperrt) or ist_moderator())
  ));


-- ════════════════════════════════════════════════════════════════
-- 4. Teilen per Link: zwei eng geschnittene Funktionen
--
-- Warum nicht per Policy? Eine RLS-Policy sieht nur `auth.uid()`, nie den
-- Link. Ein Token in einer Policy müsste über eine Session-Variable
-- gesetzt werden – umständlich und leicht falsch zu benutzen. Zwei
-- `security definer`-Funktionen sind der ehrlichere Weg: sie geben
-- exakt die Route zum Token frei und sonst nichts.
-- ════════════════════════════════════════════════════════════════

-- 4a. Vorschau – bewusst auch für Nicht-Angemeldete, damit ein geteilter
--     Link erst zeigt, worum es geht, und dann zum Anmelden einlädt.
create or replace function route_per_token(p_token text)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public
as $$
declare
  r routen;
  stops jsonb;
begin
  select * into r from routen where teilen_token = p_token;
  if not found or r.gesperrt then
    return jsonb_build_object('gefunden', false);
  end if;

  select coalesce(jsonb_agg(s order by s.position), '[]'::jsonb) into stops
  from (
    select rs.name, rs.lat, rs.lng, rs.adresse, rs.position
    from routen_stops rs
    where rs.route_id = r.id
    order by rs.position
  ) s;

  return jsonb_build_object(
    'gefunden', true,
    'route', jsonb_build_object(
      'id',            r.id,
      'name',          r.name,
      'beschreibung',  r.beschreibung,
      'stadt_id',      r.stadt_id,
      'sichtbarkeit',  r.sichtbarkeit,
      'teilen_token',  r.teilen_token,
      'erstellt_am',   r.erstellt_am,
      'ist_eigene',    r.ersteller_user_id = auth.uid()
    ),
    'stops', stops
  );
end;
$$;

grant execute on function route_per_token(text) to anon, authenticated;


-- 4b. Übernehmen – legt eine eigene, private Kopie der Route an.
--
--     Bars werden dabei so aufgelöst:
--       • öffentliche Bar          → bleibt referenziert (kein Duplikat)
--       • eigene Bar               → bleibt referenziert
--       • fremde private Bar       → wird als eigene private Kopie
--                                    angelegt, herkunft = 'uebernommen'
--       • Bar bereits übernommen   → vorhandene Kopie wird wiederverwendet
--       • Stop ohne bar_id         → reiner Snapshot, bleibt Snapshot
--
--     Rückgabe: {ok:true, route_id, name} oder {ok:false, fehler:'…'}
create or replace function route_uebernehmen(p_token text, p_name text)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  quelle     routen;
  neue_id    uuid;
  sauber     text := nullif(btrim(coalesce(p_name, '')), '');
  s          record;
  b          bars;
  ziel_bar   uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'fehler', 'nicht_angemeldet');
  end if;

  select * into quelle from routen where teilen_token = p_token;
  if not found or quelle.gesperrt then
    return jsonb_build_object('ok', false, 'fehler', 'unbekannt');
  end if;

  if quelle.ersteller_user_id = uid then
    return jsonb_build_object('ok', false, 'fehler', 'eigene_route',
                              'route_id', quelle.id);
  end if;

  if sauber is null then
    return jsonb_build_object('ok', false, 'fehler', 'name_leer');
  end if;

  -- Namensregel: pro Spieler:in nur einmal. Wird zusätzlich vom
  -- unique index abgesichert, hier aber freundlich zurückgemeldet.
  if exists (
    select 1 from routen
    where ersteller_user_id = uid and lower(name) = lower(sauber)
  ) then
    return jsonb_build_object('ok', false, 'fehler', 'name_belegt');
  end if;

  insert into routen (name, beschreibung, stadt_id, ersteller_user_id,
                      sichtbarkeit, quelle_route_id)
  values (sauber, quelle.beschreibung, quelle.stadt_id, uid,
          'privat', quelle.id)
  returning id into neue_id;

  for s in
    select rs.* from routen_stops rs
    where rs.route_id = quelle.id
    order by rs.position
  loop
    ziel_bar := null;

    if s.bar_id is not null then
      select * into b from bars where id = s.bar_id;

      if found then
        if b.ersteller_user_id = uid then
          ziel_bar := b.id;                                   -- schon meine
        elsif b.sichtbarkeit = 'oeffentlich' and not b.gesperrt then
          ziel_bar := b.id;                                   -- global lesbar
        else
          -- fremde private Bar: einmalig als eigene Kopie übernehmen
          select id into ziel_bar
          from bars
          where ersteller_user_id = uid and quelle_bar_id = b.id
          limit 1;

          if ziel_bar is null then
            insert into bars (name, lat, lng, adresse, stadt_id, kategorie,
                              ersteller_user_id, sichtbarkeit, herkunft,
                              quelle_bar_id)
            values (b.name, b.lat, b.lng, b.adresse, b.stadt_id, b.kategorie,
                    uid, 'privat', 'uebernommen', b.id)
            returning id into ziel_bar;
          end if;
        end if;
      end if;
    end if;

    insert into routen_stops (route_id, bar_id, name, lat, lng, adresse, position)
    values (neue_id, ziel_bar, s.name, s.lat, s.lng, s.adresse, s.position);
  end loop;

  return jsonb_build_object('ok', true, 'route_id', neue_id, 'name', sauber);
end;
$$;

grant execute on function route_uebernehmen(text, text) to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 5. Nützliche Abfragen (bei Bedarf einzeln ausführen)
-- ════════════════════════════════════════════════════════════════
-- Öffentliche Routen mit Stop-Anzahl:
--   select r.name, r.beschreibung, count(s.id) as stops
--   from routen r left join routen_stops s on s.route_id = r.id
--   where r.sichtbarkeit = 'oeffentlich' and not r.gesperrt
--   group by r.id order by r.geaendert_am desc;
--
-- Route sperren (nur Moderation):
--   update routen set gesperrt = true where id = '…';
--
-- Teilen-Link zurücksetzen (alter Link wird sofort ungültig):
--   update routen set teilen_token = neuer_routen_token() where id = '…';
