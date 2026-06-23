-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Datenbankschema v3 (Supabase / PostgreSQL)
-- Import: Supabase Dashboard → SQL Editor → komplett einfügen → RUN.
--
-- Neu in v3 gegenüber dem Prototyp:
--   • Echte Benutzerkonten über Supabase Auth (auth.users)
--   • Kuratierte Städte + Kneipen-Vorlagen (Bonn, Köln)
--   • Pro Tour eine eigene, sortierbare Kneipen-Route (tour_kneipen)
--   • Teilnehmer (auch mehrere pro Gerät / Pass-and-Play)
--   • Geteilte Challenge je Kneipe, persönliche Ergebnisse, Realtime
-- ════════════════════════════════════════════════════════════════

-- ── Sauberer Neustart (nur bei Bedarf; löscht ALLE Daten) ───────
-- drop table if exists ergebnisse, kneipen_challenge, teilnehmer,
--   tour_kneipen, touren, kneipen_vorlage, spielformen, staedte cascade;

-- ════════════════════════════════════════════════════════════════
-- Stammdaten
-- ════════════════════════════════════════════════════════════════
create table if not exists staedte (
  id    bigint generated always as identity primary key,
  name  text not null,
  slug  text unique not null,
  lat   double precision not null,
  lng   double precision not null,
  zoom  int default 14
);

create table if not exists kneipen_vorlage (
  id         bigint generated always as identity primary key,
  stadt_id   bigint not null references staedte(id) on delete cascade,
  name       text not null,
  lat        double precision not null,
  lng        double precision not null,
  adresse    text,
  sortierung int default 0
);

create table if not exists spielformen (
  id            bigint generated always as identity primary key,
  titel         text not null,
  beschreibung  text not null,
  schwierigkeit int default 1
);

-- ════════════════════════════════════════════════════════════════
-- Touren (gehören einem angemeldeten Host)
-- ════════════════════════════════════════════════════════════════
create table if not exists touren (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,
  name                text,
  stadt_id            bigint references staedte(id),
  host_user_id        uuid references auth.users(id) on delete set null,
  par_schwelle        int     default 3,
  strafe_aktiv        boolean default true,
  strafe_pro_schluck  int     default 1,
  verweigerung_strafe int     default 5,
  status              text    default 'lobby',   -- lobby | laufend | beendet
  glas_typ            text    default 'bier',    -- bier | wein | sekt | cocktail (Pin-Symbol)
  erstellt_am         timestamptz default now()
);

-- Falls die Tabelle schon existierte (fruehere Version): Spalte nachruesten
alter table touren add column if not exists glas_typ text default 'bier';

-- Konkrete, sortierte Route dieser Tour (Kopie aus Vorlage + eigene Stops)
create table if not exists tour_kneipen (
  id        uuid primary key default gen_random_uuid(),
  tour_id   uuid not null references touren(id) on delete cascade,
  name      text not null,
  lat       double precision not null,
  lng       double precision not null,
  adresse   text,
  position  int not null default 0
);

-- Teilnehmer: user_id gesetzt = eigenes Konto; NULL = Pass-and-Play-Person
create table if not exists teilnehmer (
  id          uuid primary key default gen_random_uuid(),
  tour_id     uuid not null references touren(id) on delete cascade,
  name        text not null,
  user_id     uuid references auth.users(id) on delete set null,
  erstellt_am timestamptz default now()
);

-- Einmal pro Kneipe gezogene Spielform (für alle Teilnehmer gleich)
create table if not exists kneipen_challenge (
  tour_id        uuid not null references touren(id) on delete cascade,
  tour_kneipe_id uuid not null references tour_kneipen(id) on delete cascade,
  spielform_id   bigint not null references spielformen(id),
  gezogen_am     timestamptz default now(),
  primary key (tour_id, tour_kneipe_id)
);

-- Persönliche Ergebnisse (Realtime-Quelle der Rangliste)
create table if not exists ergebnisse (
  id             uuid primary key default gen_random_uuid(),
  tour_id        uuid not null references touren(id) on delete cascade,
  tour_kneipe_id uuid not null references tour_kneipen(id) on delete cascade,
  teilnehmer_id  uuid not null references teilnehmer(id) on delete cascade,
  schlucke       int     default 0,
  strafschlucke  int     default 0,
  erledigt       boolean default false,
  erledigt_am    timestamptz,
  unique (tour_id, tour_kneipe_id, teilnehmer_id)
);

-- ════════════════════════════════════════════════════════════════
-- Realtime aktivieren (Live-Rangliste & Lobby)
-- ════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table ergebnisse;
alter publication supabase_realtime add table teilnehmer;
alter publication supabase_realtime add table touren;
alter publication supabase_realtime add table kneipen_challenge;

-- ════════════════════════════════════════════════════════════════
-- Row Level Security
-- Bewusst offen für angemeldete Nutzer (privater Freundeskreis,
-- erster Test). Später feiner über Mitgliedschaften einschränkbar.
-- ════════════════════════════════════════════════════════════════
alter table staedte           enable row level security;
alter table kneipen_vorlage   enable row level security;
alter table spielformen       enable row level security;
alter table touren            enable row level security;
alter table tour_kneipen      enable row level security;
alter table teilnehmer        enable row level security;
alter table kneipen_challenge enable row level security;
alter table ergebnisse        enable row level security;

-- Stammdaten: jede:r Angemeldete darf lesen
create policy "staedte_lesen"   on staedte         for select to authenticated using (true);
create policy "vorlage_lesen"   on kneipen_vorlage for select to authenticated using (true);
create policy "spielform_lesen" on spielformen     for select to authenticated using (true);

-- Touren: lesen alle Angemeldeten (zum Beitreten per Code);
-- anlegen nur als eigener Host; ändern nur der Host
create policy "touren_lesen"  on touren for select to authenticated using (true);
create policy "touren_neu"    on touren for insert to authenticated with check (host_user_id = auth.uid());
create policy "touren_aend"   on touren for update to authenticated using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());
create policy "touren_loesch" on touren for delete to authenticated using (host_user_id = auth.uid());

-- Spiel-Tabellen: mitgliedschaftsbasiert (Host oder Teilnehmer der Tour).
-- Helper-Funktion (SECURITY DEFINER umgeht RLS im Inneren -> keine Rekursion):
create or replace function public.darf_tour(t uuid)
returns boolean language sql security definer set search_path = public stable as $func$
  select exists (select 1 from touren     where id = t      and host_user_id = auth.uid())
      or exists (select 1 from teilnehmer where tour_id = t and user_id      = auth.uid());
$func$;
grant execute on function public.darf_tour(uuid) to authenticated;

-- tour_kneipen: lesen Mitglieder/Host, schreiben nur Host
create policy "tk_lesen" on tour_kneipen for select to authenticated using (darf_tour(tour_id));
create policy "tk_host"  on tour_kneipen for all to authenticated
  using      (exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()))
  with check (exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()));

-- kneipen_challenge: lesen Mitglieder/Host, schreiben nur Host
create policy "kc_lesen" on kneipen_challenge for select to authenticated using (darf_tour(tour_id));
create policy "kc_host"  on kneipen_challenge for all to authenticated
  using      (exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()))
  with check (exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()));

-- teilnehmer: lesen Mitglieder/Host, beitreten (selbst) oder als Mitglied, löschen Host/selbst
create policy "tn_lesen"     on teilnehmer for select to authenticated using (darf_tour(tour_id));
create policy "tn_beitreten" on teilnehmer for insert to authenticated
  with check (user_id = auth.uid() or darf_tour(tour_id));
create policy "tn_verwalten" on teilnehmer for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()));

-- ergebnisse: nur Mitglieder/Host lesen & schreiben
create policy "er_mitglied" on ergebnisse for all to authenticated
  using (darf_tour(tour_id)) with check (darf_tour(tour_id));

-- ════════════════════════════════════════════════════════════════
-- Seed: Spielformen (alkoholneutral – „Getränk“ statt „Bier“)
-- ════════════════════════════════════════════════════════════════
insert into spielformen (titel, beschreibung, schwierigkeit) values
  ('Fremde Hand', 'Dein:e Nachbar:in hält das Glas – du darfst es nicht berühren.', 2),
  ('Karussell',   'Dreh dich beim Trinken langsam einmal im Kreis.', 2),
  ('Linkshänder', 'Trink ausschließlich mit der schwächeren Hand.', 1),
  ('Blindflug',   'Augen zu, von Anfang bis Ende.', 2),
  ('Storch',      'Steh dabei auf nur einem Bein.', 2),
  ('Über Kreuz',  'Häng deinen Arm beim Trinken mit der Person neben dir ein.', 2),
  ('Vornehm',     'Der kleine Finger muss die ganze Zeit abstehen.', 1),
  ('Countdown',   'Der Tisch zählt laut mit – trink im Takt.', 1),
  ('Rückwärts',   'Geh beim Trinken ein paar Schritte rückwärts.', 3),
  ('Sänger',      'Summe durchgehend eine Melodie, ohne abzusetzen.', 3),
  ('Stumm',       'Kein Wort, bis das Glas leer ist – nur Gesten.', 1),
  ('Dirigent',    'Führe mit der freien Hand einen unsichtbaren Chor.', 1);

-- ════════════════════════════════════════════════════════════════
-- Seed: Städte
-- ════════════════════════════════════════════════════════════════
insert into staedte (name, slug, lat, lng, zoom) values
  ('Bonn', 'bonn', 50.7340, 7.0996, 15),
  ('Köln', 'koeln', 50.9384, 6.9594, 15)
on conflict (slug) do nothing;

-- ════════════════════════════════════════════════════════════════
-- Seed: kuratierte Kneipen
-- Koordinaten sind nah dran, aber leicht in Supabase korrigierbar
-- (Table Editor → kneipen_vorlage). Adressen aus öffentlichen Quellen.
-- ════════════════════════════════════════════════════════════════
insert into kneipen_vorlage (stadt_id, name, lat, lng, adresse, sortierung)
select s.id, v.name, v.lat, v.lng, v.adresse, v.sortierung
from staedte s
join (values
  -- BONN
  ('bonn', 'Brauhaus Bönnsch', 50.7338, 7.0975, 'Sterntorbrücke 4, 53111 Bonn', 1),
  ('bonn', 'Em Höttche',       50.7341, 7.1003, 'Markt 4, 53111 Bonn', 2),
  ('bonn', 'Café Spitz',       50.7339, 7.0972, 'Sterntorbrücke 10, 53111 Bonn', 3),
  ('bonn', 'Sausalitos',       50.7355, 7.0985, 'Bottlerplatz 1, 53111 Bonn', 4),
  ('bonn', 'Pawlow',           50.7449, 7.0944, 'Heerstraße 64, 53111 Bonn', 5),
  ('bonn', 'Bla',              50.7430, 7.0951, 'Heerstraße 52, 53111 Bonn', 6),
  -- KÖLN
  ('koeln', 'Früh am Dom',             50.9389, 6.9576, 'Am Hof 12-18, 50667 Köln', 1),
  ('koeln', 'Brauhaus Sion',           50.9382, 6.9601, 'Unter Taschenmacher 5-7, 50667 Köln', 2),
  ('koeln', 'Peters Brauhaus',         50.9379, 6.9609, 'Mühlengasse 1, 50667 Köln', 3),
  ('koeln', 'Gaffel am Dom',           50.9425, 6.9582, 'Bahnhofsvorplatz 1, 50667 Köln', 4),
  ('koeln', 'Brauerei zur Malzmühle',  50.9360, 6.9606, 'Heumarkt 6, 50667 Köln', 5),
  ('koeln', 'Brauhaus Päffgen',        50.9407, 6.9433, 'Friesenstraße 64-66, 50670 Köln', 6),
  ('koeln', 'Hellers Brauhaus',        50.9270, 6.9385, 'Roonstraße 33, 50674 Köln', 7)
) as v(stadt_slug, name, lat, lng, adresse, sortierung)
  on v.stadt_slug = s.slug;
