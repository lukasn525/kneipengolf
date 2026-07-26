-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Spielform-Snapshot (v1.3)
-- Die Challenge einer Kneipe speichert Titel + Beschreibung als
-- Momentaufnahme. So funktionieren auch eigene (tour-lokale) Spielformen,
-- ohne die globale spielformen-Tabelle zu verwässern. spielform_id wird
-- optional (null bei eigener Spielform).
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

alter table kneipen_challenge add column if not exists titel text;
alter table kneipen_challenge add column if not exists beschreibung text;
alter table kneipen_challenge alter column spielform_id drop not null;
