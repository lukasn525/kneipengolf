-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Tour erstellen wieder möglich machen (v5.2)
--
-- FEHLER: „new row violates row-level security policy for table
--         "touren"" beim Klick auf „Spiel erstellen".
--
-- URSACHE: Nicht die INSERT-Regel, sondern die LESE-Regel.
--   Der Client schreibt mit `.insert(...).select()`, das wird zu
--   `insert ... returning *`. Postgres prüft die zurückgegebene Zeile
--   zusätzlich gegen die SELECT-Policy – und die lautete seit
--   `12_rls_mitgliedschaft.sql` nur noch `darf_tour(id)`.
--
--   `darf_tour` ist `stable` und arbeitet damit auf dem Snapshot des
--   laufenden Statements. Die Zeile, die dasselbe Statement gerade
--   einfügt, steht in diesem Snapshot noch nicht. Die Funktion sucht
--   also in `touren` nach einer Tour, die es für sie noch nicht gibt,
--   liefert `false` – und das RETURNING scheitert. Ohne `returning`
--   lief derselbe INSERT durch; genau deshalb war der Fehler so
--   irreführend.
--
-- LÖSUNG: Den Host-Fall direkt in der Policy prüfen. `host_user_id =
--   auth.uid()` liest die neue Zeile selbst statt die Tabelle – kein
--   Snapshot, kein Henne-Ei. `darf_tour(id)` bleibt für alle anderen
--   Beteiligten daneben stehen.
--
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

drop policy if exists touren_lesen on touren;
create policy touren_lesen on touren
  for select to authenticated
  using (host_user_id = auth.uid() or darf_tour(id));

-- ── Warum nur `touren` betroffen ist ─────────────────────────────
-- Dieselbe Falle stellt jede Lese-Policy, die ihre EIGENE Tabelle
-- abfragt. Von den Tabellen, in die der Client mit `.select()`
-- schreibt, tat das nur `touren`:
--   tour_kneipen, kneipen_challenge → `ist_host(tour_id)` liest
--     `touren`; die Tour stammt aus einem früheren Request und steht
--     längst im Snapshot.
--   teilnehmer → Beitritt läuft über `tour_beitreten` (security
--     definer, RLS innen aus).
--   routen_stops → liest `routen`, andere Tabelle.
-- Merksatz für neue Policies: Wenn der Client `.select()` anhängt,
-- muss die SELECT-Policy allein aus den Spalten der neuen Zeile
-- entscheidbar sein.
