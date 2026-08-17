-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Nachlauf zu 12: geraet_id entfernen (v5.1)
--
-- ⚠ ERST AUSFÜHREN, WENN `12_rls_mitgliedschaft.sql` UND das passende
--   Frontend live sind. Sonst schreibt der alte Client noch in eine
--   Spalte, die es nicht mehr gibt. Gleiche Regel wie bei
--   `10_aufraeumen.sql`: erst deployen, dann wegräumen.
--
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

-- `geraet_id` war eine UUID aus dem localStorage: gelöscht mit den
-- Browserdaten, weg beim Handywechsel – und als Rechtekriterium wertlos,
-- weil der Client sie selbst mitschickt. `verwaltet_von` (Migration 12)
-- ersetzt sie vollständig und hängt am Konto.
alter table teilnehmer drop column if exists geraet_id;

-- Jede Zeile ist entweder ein Konto ODER ein Gast mit Besitzer –
-- nie beides, nie keines von beidem. Die Regel steht erst hier, weil
-- der alte Client Gäste noch ohne `verwaltet_von` anlegt.
alter table teilnehmer drop constraint if exists teilnehmer_konto_oder_gast;
alter table teilnehmer add constraint teilnehmer_konto_oder_gast
  check (num_nonnulls(user_id, verwaltet_von) = 1);

-- Falls doch noch eine Altzeile ohne beides existiert, meldet sich die
-- Zeile oben mit einem Fehler. Dann vorher aufräumen:
--   select id, tour_id, name from teilnehmer
--    where user_id is null and verwaltet_von is null;
-- Diese Gäste stammen aus der Zeit vor v5.0; sinnvollster Besitzer ist
-- der Host ihrer Tour:
--   update teilnehmer tn set verwaltet_von = t.host_user_id
--     from touren t where t.id = tn.tour_id
--      and tn.user_id is null and tn.verwaltet_von is null
--      and t.host_user_id is not null;
