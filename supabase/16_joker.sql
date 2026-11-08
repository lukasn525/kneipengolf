-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Joker (v5.3)
--
-- REGEL: Jede:r, die/der mitspielt, darf einmal pro Abend ein Spiel
--   überspringen. Der Stop zählt dann 1 Schluck. Wer den Joker nicht
--   zieht, bekommt nach Tourende `joker_bonus` Punkte abgezogen.
--   Eingeschaltet wird der Joker in den Spielregeln beim Erstellen,
--   Standard ist aus. Ein gezogener Joker ist endgültig.
--
--   • touren.joker_aktiv  – Joker in dieser Tour an/aus
--   • touren.joker_bonus  – Bonus ohne Joker, 1 bis 3 Punkte
--   • ergebnisse.joker    – dieser Stop wurde mit dem Joker übersprungen
--
-- Die Datenbank sichert nur „höchstens ein Joker pro Teilnehmer" ab
-- (Teilnehmer gelten je Tour, also einer pro Abend). Rechnen tut
-- `src/lib/game.ts`. Die Policies bleiben unverändert: Wer werten darf,
-- darf auch den Joker ziehen.
--
-- Rein additiv – ältere Clients schreiben weiter wie bisher, ihre
-- Touren bekommen `joker_aktiv = false`.
--
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

alter table touren     add column if not exists joker_aktiv boolean not null default false;
alter table touren     add column if not exists joker_bonus integer not null default 2;
alter table ergebnisse add column if not exists joker       boolean not null default false;

alter table touren drop constraint if exists touren_joker_bonus_bereich;
alter table touren add  constraint touren_joker_bonus_bereich check (joker_bonus between 1 and 3);

create unique index if not exists ergebnisse_ein_joker_je_teilnehmer
  on ergebnisse (teilnehmer_id) where joker;
