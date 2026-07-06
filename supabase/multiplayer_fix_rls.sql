-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Multiplayer-Fix (v3.2)
-- Setzt die Spiel-Tabellen auf offene "authenticated"-Policies zurück.
-- Grund: Die ganze Seite liegt bereits hinter Zugangscode + Login
-- (privater Freundeskreis). Die fein granulare Pro-Tour-RLS blockierte
-- das Zusammenspiel (leere Lobby vor Beitritt, Realtime kam nicht an).
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

-- Verschärfte Policies (v3.1) entfernen …
drop policy if exists "tk_lesen"     on tour_kneipen;
drop policy if exists "tk_host"      on tour_kneipen;
drop policy if exists "kc_lesen"     on kneipen_challenge;
drop policy if exists "kc_host"      on kneipen_challenge;
drop policy if exists "tn_lesen"     on teilnehmer;
drop policy if exists "tn_beitreten" on teilnehmer;
drop policy if exists "tn_verwalten" on teilnehmer;
drop policy if exists "er_mitglied"  on ergebnisse;

-- … und ggf. vorhandene offene Policies vor Neuanlage entfernen (idempotent)
drop policy if exists "tk_alle" on tour_kneipen;
drop policy if exists "tn_alle" on teilnehmer;
drop policy if exists "kc_alle" on kneipen_challenge;
drop policy if exists "er_alle" on ergebnisse;

-- Offene Policies für Angemeldete (lesen & schreiben)
create policy "tk_alle" on tour_kneipen      for all to authenticated using (true) with check (true);
create policy "tn_alle" on teilnehmer        for all to authenticated using (true) with check (true);
create policy "kc_alle" on kneipen_challenge for all to authenticated using (true) with check (true);
create policy "er_alle" on ergebnisse        for all to authenticated using (true) with check (true);

-- Realtime sicherstellen (Fehler ignorieren, falls Tabelle schon publiziert)
do $$
begin
  begin alter publication supabase_realtime add table ergebnisse;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table teilnehmer;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table touren;            exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table kneipen_challenge; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table tour_kneipen;      exception when duplicate_object then null; end;
end $$;
