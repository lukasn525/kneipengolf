-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – RLS verschärfen (v3.1)
-- In Supabase: SQL Editor → komplett einfügen → RUN. Mehrfach ausführbar.
-- Ersetzt die offenen Test-Policies durch mitgliedschaftsbasierte.
-- ════════════════════════════════════════════════════════════════

-- Helper: Ist der aktuelle Nutzer Host ODER Teilnehmer dieser Tour?
-- SECURITY DEFINER umgeht RLS im Funktionsinneren (verhindert Rekursion).
create or replace function public.darf_tour(t uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from touren     where id = t      and host_user_id = auth.uid())
      or exists (select 1 from teilnehmer where tour_id = t and user_id      = auth.uid());
$$;

grant execute on function public.darf_tour(uuid) to authenticated;

-- Alte/vorherige Policies entfernen (offen ODER aus früherem Lauf dieses Skripts)
drop policy if exists "tk_alle"      on tour_kneipen;
drop policy if exists "tk_lesen"     on tour_kneipen;
drop policy if exists "tk_host"      on tour_kneipen;
drop policy if exists "kc_alle"      on kneipen_challenge;
drop policy if exists "kc_lesen"     on kneipen_challenge;
drop policy if exists "kc_host"      on kneipen_challenge;
drop policy if exists "tn_alle"      on teilnehmer;
drop policy if exists "tn_lesen"     on teilnehmer;
drop policy if exists "tn_beitreten" on teilnehmer;
drop policy if exists "tn_verwalten" on teilnehmer;
drop policy if exists "er_alle"      on ergebnisse;
drop policy if exists "er_mitglied"  on ergebnisse;

-- tour_kneipen: lesen Mitglieder/Host · schreiben nur Host
create policy "tk_lesen" on tour_kneipen for select to authenticated
  using (darf_tour(tour_id));
create policy "tk_host" on tour_kneipen for all to authenticated
  using      (exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()))
  with check (exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()));

-- kneipen_challenge: lesen Mitglieder/Host · schreiben nur Host
create policy "kc_lesen" on kneipen_challenge for select to authenticated
  using (darf_tour(tour_id));
create policy "kc_host" on kneipen_challenge for all to authenticated
  using      (exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()))
  with check (exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()));

-- teilnehmer: lesen Mitglieder/Host · beitreten (sich selbst) oder als Mitglied weitere Personen · löschen Host/selbst
create policy "tn_lesen" on teilnehmer for select to authenticated
  using (darf_tour(tour_id));
create policy "tn_beitreten" on teilnehmer for insert to authenticated
  with check (user_id = auth.uid() or darf_tour(tour_id));
create policy "tn_verwalten" on teilnehmer for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from touren where id = tour_id and host_user_id = auth.uid()));

-- ergebnisse: nur Mitglieder/Host der Tour lesen & schreiben
create policy "er_mitglied" on ergebnisse for all to authenticated
  using (darf_tour(tour_id))
  with check (darf_tour(tour_id));
