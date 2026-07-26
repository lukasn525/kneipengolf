-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Spiel-Modus (v3.4)
-- Fügt der Tour einen Modus hinzu: 'einzel' (jede:r für sich)
-- oder 'team' (ein Gerät = ein Team, Pass-and-Play im Team).
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

alter table touren add column if not exists spiel_modus text default 'einzel';
