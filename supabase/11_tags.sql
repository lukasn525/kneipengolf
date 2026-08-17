-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Tags für Bars (v4.2)
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- Konzept: claude/tags-konzept.md
-- ════════════════════════════════════════════════════════════════

-- Ein Array statt einer Verknüpfungstabelle: bei höchstens drei Tags aus
-- einer kurzen festen Liste kostet ein Join nur Komplexität – zusätzliche
-- RLS-Regeln, ein Join pro Abfrage, mehr Code beim Speichern.
alter table bars add column if not exists tags text[] not null default '{}';

-- WICHTIG: Hier steht bewusst KEINE Prüfung auf erlaubte Werte.
-- Das Vokabular lebt allein in `src/lib/tags.ts`. Einen Tag umbenennen,
-- ergänzen oder streichen ist damit eine Zeile im Code – ohne Migration,
-- ohne Deploy-Reihenfolge, ohne dass bestehende Zeilen ungültig werden.
-- Der Preis: die Liste ist nicht zur Laufzeit änderbar, und ein Tippfehler
-- im Code fällt erst in der Anzeige auf (dort wird er als „unbekannt"
-- dargestellt, statt etwas kaputtzumachen).
--
-- Geprüft wird nur, was unabhängig vom Vokabular gilt:
alter table bars drop constraint if exists bars_tags_max3;
alter table bars add constraint bars_tags_max3
  check (cardinality(tags) <= 3);

alter table bars drop constraint if exists bars_tags_nicht_leer;
alter table bars add constraint bars_tags_nicht_leer
  check (not ('' = any (tags)) and array_position(tags, null) is null);

-- Filtert `tags && '{laut,tanzen}'` über den Index statt über alle Zeilen.
create index if not exists bars_tags_idx on bars using gin (tags);

-- Rechte: keine neuen Policies nötig. `bars_aendern` erlaubt dem Ersteller
-- (und der Moderation) das Ändern der ganzen Zeile – Tags fahren dort mit.
-- Tags steuern keine Sichtbarkeit; sie beschreiben, sie berechtigen nicht.
