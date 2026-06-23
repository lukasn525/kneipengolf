-- Kneipen-Challenge – Datenbankschema v2 für Supabase (PostgreSQL)
-- Import: Supabase Dashboard → SQL Editor → einfügen → Run.
--
-- Neu in v2: Teilnehmer-Ebene, geteilte Challenge pro Kneipe,
-- Tour-Einstellungen (Golf-Wertung), tour-eigene Zusatz-Kneipen, Realtime.

-- ─────────────────────────────────────────────────────────────
-- Touren + Einstellungen
-- ─────────────────────────────────────────────────────────────
create table if not exists touren (
  id                 bigint generated always as identity primary key,
  code               text unique not null,        -- geteilter Tour-Code, z.B. 'BONN-7F3K'
  name               text,
  par_schwelle       int     default 3,           -- ab hier Minuspunkte (Golf)
  strafe_aktiv       boolean default true,        -- Golf-Strafe an/aus
  strafe_pro_schluck int     default 1,           -- Strafpunkte je Schluck über Par
  verweigerung_strafe int    default 5,           -- Strafschlücke bei "nicht machbar"
  erstellt_am        timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Teilnehmer (treten per Name bei)
-- ─────────────────────────────────────────────────────────────
create table if not exists teilnehmer (
  id            bigint generated always as identity primary key,
  tour_id       bigint not null references touren(id) on delete cascade,
  name          text   not null,
  beigetreten_am timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Kneipen: tour_id NULL = globale Startliste, gesetzt = von Tour ergänzt
-- ─────────────────────────────────────────────────────────────
create table if not exists kneipen (
  id          bigint generated always as identity primary key,
  name        text    not null,
  lat         double precision not null,
  lng         double precision not null,
  adresse     text,
  sortierung  int     default 0,
  tour_id     bigint  references touren(id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Spielformen (Stammdaten, alkoholneutral formuliert)
-- ─────────────────────────────────────────────────────────────
create table if not exists spielformen (
  id            bigint generated always as identity primary key,
  titel         text not null,
  beschreibung  text not null,
  schwierigkeit int  default 1
);

-- ─────────────────────────────────────────────────────────────
-- Gezogene Challenge JE KNEIPE (geteilt für alle Teilnehmer der Tour)
-- ─────────────────────────────────────────────────────────────
create table if not exists kneipen_challenge (
  tour_id      bigint not null references touren(id) on delete cascade,
  kneipe_id    bigint not null references kneipen(id) on delete cascade,
  spielform_id bigint not null references spielformen(id),
  gezogen_am   timestamptz default now(),
  primary key (tour_id, kneipe_id)
);

-- ─────────────────────────────────────────────────────────────
-- Persönliche Ergebnisse je Teilnehmer & Kneipe (Realtime-Quelle)
-- ─────────────────────────────────────────────────────────────
create table if not exists ergebnisse (
  id            bigint generated always as identity primary key,
  tour_id       bigint not null references touren(id) on delete cascade,
  kneipe_id     bigint not null references kneipen(id) on delete cascade,
  teilnehmer_id bigint not null references teilnehmer(id) on delete cascade,
  schlucke      int     default 0,
  strafschlucke int     default 0,                -- bei verweigerter Challenge
  erledigt      boolean default false,
  erledigt_am   timestamptz,
  unique (tour_id, kneipe_id, teilnehmer_id)
);

-- ─────────────────────────────────────────────────────────────
-- Realtime aktivieren (live Rangliste)
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table ergebnisse;
alter publication supabase_realtime add table teilnehmer;
alter publication supabase_realtime add table kneipen_challenge;

-- ─────────────────────────────────────────────────────────────
-- Zugriff ohne Login (Tour-Code = "Passwort"). Für den privaten
-- Kreis offen; bei Bedarf später über Policies verschärfen.
-- ─────────────────────────────────────────────────────────────
alter table touren            enable row level security;
alter table teilnehmer        enable row level security;
alter table kneipen           enable row level security;
alter table spielformen       enable row level security;
alter table kneipen_challenge enable row level security;
alter table ergebnisse        enable row level security;

create policy "offen" on touren            for all using (true) with check (true);
create policy "offen" on teilnehmer        for all using (true) with check (true);
create policy "offen" on kneipen           for all using (true) with check (true);
create policy "lesen" on spielformen       for select using (true);
create policy "offen" on kneipen_challenge for all using (true) with check (true);
create policy "offen" on ergebnisse        for all using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- Beispiel-Spielformen (alkoholneutral; "Getränk" statt "Bier")
-- ─────────────────────────────────────────────────────────────
insert into spielformen (titel, beschreibung, schwierigkeit) values
  ('Fremde Hand', 'Dein Teampartner hält das Glas – du darfst es nicht berühren.', 2),
  ('Karussell',   'Dreh dich beim Trinken langsam einmal im Kreis.', 2),
  ('Linkshänder', 'Trink ausschließlich mit der schwächeren Hand.', 1),
  ('Blindflug',   'Augen zu, von Anfang bis Ende.', 2),
  ('Storch',      'Steh dabei auf nur einem Bein.', 2),
  ('Über Kreuz',  'Häng deinen Arm beim Trinken mit dem Partner ein (Hochzeits-Stil).', 2),
  ('Vornehm',     'Der kleine Finger muss die ganze Zeit abstehen.', 1),
  ('Countdown',   'Der Tisch zählt laut mit – trink im Takt.', 1),
  ('Rückwärts',   'Geh beim Trinken rückwärts ein paar Schritte.', 3),
  ('Sänger',      'Summe durchgehend eine Melodie, ohne abzusetzen.', 3);

-- Globale Start-Kneipen (tour_id = NULL). Platzhalter rund um Bonn.
insert into kneipen (name, lat, lng, adresse, sortierung, tour_id) values
  ('Startpunkt Markt', 50.7344, 7.0989, 'Markt, 53111 Bonn',   1, null),
  ('Alte Schänke',     50.7368, 7.1006, 'Beispielstr. 1, Bonn', 2, null),
  ('Eckkneipe Süd',    50.7311, 7.0962, 'Beispielstr. 2, Bonn', 3, null),
  ('Hafenbar',         50.7402, 7.1051, 'Beispielstr. 3, Bonn', 4, null),
  ('Letzte Runde',     50.7289, 7.1023, 'Beispielstr. 4, Bonn', 5, null);
