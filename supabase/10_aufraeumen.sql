-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Aufräumen (v4.1)
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

-- `bars.kategorie` stammt aus v2.1 und sollte Bars grob einordnen
-- (bar | kneipe | cocktail | brauhaus). Die Spalte wird seit damals
-- nirgends mehr geschrieben und nirgends angezeigt – die Einordnung
-- übernimmt künftig das Tag-Konzept (siehe claude/tags-konzept.md).
--
-- Bewusst als eigener Schritt, NICHT zusammen mit der Tag-Migration:
-- so bleibt der Rückweg offen, falls doch noch etwas daran hängt.
alter table bars drop column if exists kategorie;
