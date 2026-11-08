-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Rechte nachziehen (Supabase-Advisor, 08.11.2026)
--
-- BEFUND: Supabase gibt jedem neuen Objekt in `public` automatisch
--   Rechte für `anon` (nicht angemeldet) und PUBLIC. `07`, `08` und `09`
--   haben jeweils nur an `authenticated` vergeben, aber nie entzogen –
--   `12` hat es richtig gemacht. Folge:
--     • `bar_beliebtheit` war ohne Login lesbar: Kennzahlen zu allen
--       Bars, auch privaten. Die View läuft bewusst als `security
--       definer` (sie zählt über alle Gruppen), deshalb griff RLS nicht.
--     • `ist_admin()`, `ist_moderator()`, `route_uebernehmen()` waren
--       ohne Login aufrufbar. Harmlos (ohne Login immer false bzw.
--       Ablehnung), aber nicht so gedacht.
--
-- BEWUSST OFFEN: `route_per_token()` bleibt für `anon` – Vorschau
--   geteilter Links ohne Login, siehe `08_routen_teilen.sql`.
--
-- Der Zugangscode schützt nur die Website, nicht die Supabase-API: Der
-- anon key steckt in jedem Browser, der die App benutzt.
--
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

-- View: anon raus, authenticated behält das Lesen
revoke all on public.bar_beliebtheit from anon;

-- Standardrecht für PUBLIC und anon entziehen (authenticated hat eigene Grants)
revoke execute on function public.ist_admin()                   from public, anon;
revoke execute on function public.ist_moderator()               from public, anon;
revoke execute on function public.route_uebernehmen(text, text) from public, anon;

-- search_path festsetzen (Advisor: function_search_path_mutable)
alter function public.bars_touch()         set search_path = '';
alter function public.routen_touch()       set search_path = '';
alter function public.neuer_routen_token() set search_path = '';

-- ── Merksatz für neue Skripte ────────────────────────────────────
-- Wer an `authenticated` vergibt, entzieht vorher `public, anon`:
--   revoke execute on function f(...) from public, anon;
--   grant  execute on function f(...) to authenticated;
