-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Zeilenschutz auf Mitgliedschaft umstellen (v5.0)
--
-- Ersetzt die offenen Policies aus `03_multiplayer_fix_rls.sql`
-- (`for all to authenticated using (true)`) durch Regeln, die an der
-- Teilnahme an einer Tour hängen.
--
-- ⚠ REIHENFOLGE: Diese Datei gehört ZUSAMMEN mit dem passenden Frontend
--   ausgerollt. Sie verschärft Schreibregeln, die der alte Client verletzt
--   (er legt Gäste ohne `verwaltet_von` an). Erst die Migration, dann
--   sofort deployen – oder umgekehrt, aber nicht Tage dazwischen.
--   `13_aufraeumen_geraet_id.sql` läuft erst NACH bestätigtem Deploy.
--
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

-- ── 1 · Gäste bekommen einen Besitzer ────────────────────────────
--
-- Ein Gast ist nur ein Name im laufenden Spiel: kein Konto, keine
-- Statistik, keine Rechte. Genau deshalb braucht er ein Konto, das für
-- ihn handelt – sonst könnte niemand für ihn werten.
--
-- Warum nicht `geraet_id`? Die steht im localStorage und wird vom Client
-- selbst mitgeschickt – jeder kann jede behaupten. Als Rechtekriterium
-- wäre sie wertlos. `auth.uid()` steht im signierten Token.
alter table teilnehmer
  add column if not exists verwaltet_von uuid references auth.users(id) on delete cascade;

comment on column teilnehmer.verwaltet_von is
  'Konto, dem dieser Gast gehört. Gesetzt genau dann, wenn user_id NULL ist.';

create index if not exists teilnehmer_verwalter_idx on teilnehmer (verwaltet_von);

-- ── 2 · Helfer: security definer bricht die Rekursion ────────────
--
-- Eine Policy auf `teilnehmer` im Sinn von „du siehst die Teilnehmer der
-- Touren, an denen du teilnimmst" würde `teilnehmer` selbst abfragen –
-- und diese Unterabfrage liefe wieder durch dieselbe Policy. Genau daran
-- ist v3.1 gescheitert („leere Lobby vor Beitritt").
--
-- `security definer` läuft mit den Rechten des Eigentümers und umgeht die
-- RLS INNERHALB der Funktion. Damit ist die Schleife gebrochen.
-- `set search_path` ist dabei Pflicht, sonst ist die Funktion angreifbar.

-- Wer gehört zur Tour? Host, Teilnehmer mit Konto, oder wer dort einen
-- Gast verwaltet (etwa der Ausrichter, der selbst nicht mitspielt).
create or replace function darf_tour(t uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from touren where id = t and host_user_id = auth.uid())
      or exists (select 1 from teilnehmer
                  where tour_id = t
                    and (user_id = auth.uid() or verwaltet_von = auth.uid()));
$$;

create or replace function ist_host(t uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from touren where id = t and host_user_id = auth.uid());
$$;

-- Wer darf für diesen Teilnehmer werten?
--   • er selbst (eigenes Konto)
--   • wer ihn als Gast angelegt hat
--   • der Host (damit ein Zahlendreher am Tisch korrigierbar bleibt)
create or replace function darf_werten(p_teilnehmer uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teilnehmer tn join touren t on t.id = tn.tour_id
    where tn.id = p_teilnehmer
      and (tn.user_id = auth.uid()
        or tn.verwaltet_von = auth.uid()
        or t.host_user_id = auth.uid())
  );
$$;

-- ── 3 · Der Weg in die Tour hinein ───────────────────────────────
--
-- Henne-Ei: Vor dem Beitritt ist `darf_tour()` falsch, also sieht man die
-- Lobby nicht, der man beitreten will. Zwei `security definer`-Funktionen
-- lösen das – dasselbe Muster wie `route_per_token` bei geteilten Routen.

-- Vorschau: gerade genug, um zu entscheiden, ob man beitritt. Bewusst
-- ohne Teilnehmerliste, ohne Stops, ohne Ergebnisse.
create or replace function tour_vorschau(p_code text)
  returns table (
    id uuid, code text, name text, status text,
    stadt_id bigint, spiel_modus text, anzahl_teilnehmer integer
  )
  language sql stable security definer set search_path = public as $$
  select t.id, t.code, t.name, t.status, t.stadt_id, t.spiel_modus,
         (select count(*)::integer from teilnehmer tn where tn.tour_id = t.id)
  from touren t
  where upper(t.code) = upper(trim(p_code));
$$;

-- Beitreten. Idempotent: zweimal antippen legt keinen zweiten Spieler an.
create or replace function tour_beitreten(p_code text, p_name text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tour uuid;
  v_status text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  select id, status into v_tour, v_status
    from touren where upper(code) = upper(trim(p_code));
  if v_tour is null then
    raise exception 'Tour nicht gefunden.' using errcode = 'P0002';
  end if;

  -- Schon dabei? Dann die bestehende Zeile zurückgeben.
  select id into v_id from teilnehmer
   where tour_id = v_tour and user_id = auth.uid();
  if v_id is not null then
    return v_id;
  end if;

  -- Einer beendeten Runde tritt man nicht mehr bei. Ansehen darf man sie
  -- weiterhin – aber nur, wenn man dabei war.
  if v_status = 'beendet' then
    raise exception 'Diese Runde ist schon vorbei.' using errcode = '42501';
  end if;

  insert into teilnehmer (tour_id, name, user_id)
  values (v_tour, coalesce(nullif(trim(p_name), ''), 'Spieler'), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Nur Angemeldete. Ohne das steht jede dieser Funktionen dem `anon`-Key
-- offen – die Advisors melden das zu Recht.
revoke execute on function darf_tour(uuid)        from public, anon;
revoke execute on function ist_host(uuid)         from public, anon;
revoke execute on function darf_werten(uuid)      from public, anon;
revoke execute on function tour_vorschau(text)    from public, anon;
revoke execute on function tour_beitreten(text, text) from public, anon;
grant execute on function darf_tour(uuid)         to authenticated;
grant execute on function ist_host(uuid)          to authenticated;
grant execute on function darf_werten(uuid)       to authenticated;
grant execute on function tour_vorschau(text)     to authenticated;
grant execute on function tour_beitreten(text, text) to authenticated;

-- ── 4 · Policies ─────────────────────────────────────────────────
-- Mehrere permissive Policies auf derselben Tabelle werden mit ODER
-- verknüpft – deshalb steht Lesen und Schreiben je in eigenen Regeln,
-- statt beides in ein `for all` zu quetschen.

-- touren: sehen nur Beteiligte. Anlegen, ändern, löschen bleibt beim Host.
drop policy if exists touren_lesen on touren;
create policy touren_lesen on touren
  for select to authenticated using (darf_tour(id));

-- teilnehmer
drop policy if exists tn_alle      on teilnehmer;
drop policy if exists tn_lesen     on teilnehmer;
drop policy if exists tn_neu       on teilnehmer;
drop policy if exists tn_aendern   on teilnehmer;
drop policy if exists tn_loeschen  on teilnehmer;

create policy tn_lesen on teilnehmer
  for select to authenticated using (darf_tour(tour_id));

-- Jeder in der Runde darf Gäste anlegen und besitzt die, die er anlegt –
-- Anna kommt an Stop 3 mit ihrer Freundin dazu und trägt sie selbst ein.
-- Sich selbst einträgt man nicht hierüber, sondern über `tour_beitreten`.
create policy tn_neu on teilnehmer
  for insert to authenticated with check (
    darf_tour(tour_id)
    and (
      (user_id = auth.uid()  and verwaltet_von is null)   -- eigenes Konto
      or (user_id is null and verwaltet_von = auth.uid()) -- eigener Gast
    )
  );

create policy tn_aendern on teilnehmer
  for update to authenticated
  using       (user_id = auth.uid() or verwaltet_von = auth.uid() or ist_host(tour_id))
  with check  (user_id = auth.uid() or verwaltet_von = auth.uid() or ist_host(tour_id));

create policy tn_loeschen on teilnehmer
  for delete to authenticated
  using (user_id = auth.uid() or verwaltet_von = auth.uid() or ist_host(tour_id));

-- tour_kneipen: alle Beteiligten lesen, nur der Host verändert die Route.
drop policy if exists tk_alle  on tour_kneipen;
drop policy if exists tk_lesen on tour_kneipen;
drop policy if exists tk_host  on tour_kneipen;

create policy tk_lesen on tour_kneipen
  for select to authenticated using (darf_tour(tour_id));
create policy tk_host on tour_kneipen
  for all to authenticated using (ist_host(tour_id)) with check (ist_host(tour_id));

-- kneipen_challenge: dito – die Spiele zieht der Host beim Erstellen.
drop policy if exists kc_alle  on kneipen_challenge;
drop policy if exists kc_lesen on kneipen_challenge;
drop policy if exists kc_host  on kneipen_challenge;

create policy kc_lesen on kneipen_challenge
  for select to authenticated using (darf_tour(tour_id));
create policy kc_host on kneipen_challenge
  for all to authenticated using (ist_host(tour_id)) with check (ist_host(tour_id));

-- ergebnisse: lesen alle in der Runde (sonst gäbe es keine Rangliste),
-- schreiben nur für sich selbst, die eigenen Gäste – oder als Host.
drop policy if exists er_alle      on ergebnisse;
drop policy if exists er_lesen     on ergebnisse;
drop policy if exists er_schreiben on ergebnisse;
drop policy if exists er_aendern   on ergebnisse;
drop policy if exists er_loeschen  on ergebnisse;

create policy er_lesen on ergebnisse
  for select to authenticated using (darf_tour(tour_id));
create policy er_schreiben on ergebnisse
  for insert to authenticated with check (darf_tour(tour_id) and darf_werten(teilnehmer_id));
create policy er_aendern on ergebnisse
  for update to authenticated
  using (darf_werten(teilnehmer_id)) with check (darf_werten(teilnehmer_id));
create policy er_loeschen on ergebnisse
  for delete to authenticated
  using (darf_werten(teilnehmer_id) or ist_host(tour_id));

-- ── 5 · Realtime ─────────────────────────────────────────────────
-- RLS gilt auch für Realtime: Was du nicht lesen darfst, kommt still
-- nicht an – kein Fehler, kein Log. Die Lese-Policies oben decken alle
-- Zeilen der eigenen Tour ab, deshalb bleibt der Live-Abgleich intakt.
-- Trotzdem: nach dem Deploy einmal mit zwei echten Konten gegenprüfen.
do $$
begin
  begin alter publication supabase_realtime add table ergebnisse;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table teilnehmer;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table touren;            exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table kneipen_challenge; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table tour_kneipen;      exception when duplicate_object then null; end;
end $$;
