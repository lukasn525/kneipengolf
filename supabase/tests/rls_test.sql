-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Prüfung der Mitgliedschafts-Policies (zu 12_rls_mitgliedschaft.sql)
--
-- In Supabase: SQL Editor → einfügen → RUN. Läuft in einer Transaktion,
-- räumt am Ende selbst auf und ändert nichts an euren Daten.
--
-- WANN AUSFÜHREN: nach jeder Änderung an einer Policy oder an
-- `darf_tour` / `ist_host` / `darf_werten` / `tour_beitreten`.
--
-- ERGEBNIS LESEN: Die letzte Ausgabe listet jede Prüfung mit „ok" oder
-- „>>> FEHLER <<<". Eine Zeile mit FEHLER heißt: Die Policy lässt etwas
-- zu, was sie nicht soll – oder verbietet etwas, was die App braucht.
--
-- ─── Warum das Ganze so aussieht ────────────────────────────────
--
-- Getestet wird nicht als Datenbank-Eigentümer, sondern als `authenticated`
-- mit gesetztem `request.jwt.claims` – nur dann greift RLS überhaupt. Der
-- Eigentümer umgeht sie, ein Test als Eigentümer wäre wertlos und würde
-- fröhlich grün leuchten.
--
-- REGEL: Jede Policy braucht einen Erlaubt- UND einen Verboten-Fall. Ein
-- Test, der nur prüft, dass etwas funktioniert, hätte `using (true)` nie
-- gefunden – genau das stand hier bis zum 17.08.2026.
-- ════════════════════════════════════════════════════════════════

begin;

-- ── Testkonten ───────────────────────────────────────────────────
-- Vier Wegwerf-Konten in auth.users. Sie verschwinden mit dem ROLLBACK
-- am Ende; keine Berührung mit euren echten Nutzern.
create temp table t_user(rolle text primary key, id uuid) on commit drop;
insert into t_user
select r, gen_random_uuid()
from unnest(array['host','anna','ben','fremd']) as r;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       rolle || '@rls-test.invalid', '', now(), now(), now()
from t_user;

create temp table t_pruef(nr serial, bereich text, fall text, erwartet boolean, ist boolean)
  on commit drop;
grant all on t_pruef to authenticated;
grant all on sequence t_pruef_nr_seq to authenticated;

do $$
declare
  v_host  uuid := (select id from t_user where rolle='host');
  v_anna  uuid := (select id from t_user where rolle='anna');
  v_ben   uuid := (select id from t_user where rolle='ben');
  v_fremd uuid := (select id from t_user where rolle='fremd');
  v_tour uuid; v_stop uuid; v_bar_oeff uuid; v_bar_priv uuid;
  v_tn_host uuid; v_tn_gastH uuid; v_tn_anna uuid; v_tn_gastA uuid; v_tn_ben uuid;
begin
  -- ── Aufbau: eine gemischte Runde, wie sie real vorkommt ────────
  -- Host mit einem Gast, Anna mit Konto und eigenem Gast, Ben tritt
  -- später bei, ein Fremder bleibt draußen.
  insert into touren (code, name, host_user_id, status)
    values ('ZZ-RLSTEST', 'RLS-Prüfrunde', v_host, 'laufend') returning id into v_tour;
  insert into tour_kneipen (tour_id, name, lat, lng, position)
    values (v_tour, 'Teststop', 50.73, 7.10, 0) returning id into v_stop;
  insert into kneipen_challenge (tour_id, tour_kneipe_id, titel, beschreibung)
    values (v_tour, v_stop, 'Testspiel', 'nur für den Test');

  insert into teilnehmer (tour_id, name, user_id)       values (v_tour,'Host',v_host)  returning id into v_tn_host;
  insert into teilnehmer (tour_id, name, verwaltet_von) values (v_tour,'Gast/Host',v_host) returning id into v_tn_gastH;
  insert into teilnehmer (tour_id, name, user_id)       values (v_tour,'Anna',v_anna)  returning id into v_tn_anna;
  insert into teilnehmer (tour_id, name, verwaltet_von) values (v_tour,'Gast/Anna',v_anna) returning id into v_tn_gastA;

  insert into bars (name, lat, lng, ersteller_user_id, sichtbarkeit)
    values ('ZZ Öffentliche Testbar', 50.73, 7.10, v_host, 'oeffentlich') returning id into v_bar_oeff;
  insert into bars (name, lat, lng, ersteller_user_id, sichtbarkeit)
    values ('ZZ Private Testbar', 50.73, 7.10, v_host, 'privat') returning id into v_bar_priv;

  perform set_config('role','authenticated',true);

  -- ═══════════════════════════════════════════════════════════════
  -- FREMDER – steht komplett draußen
  -- ═══════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', v_fremd)::text, true);

  insert into t_pruef(bereich,fall,erwartet,ist) values
    ('fremd','liest die Tour',            false, exists(select 1 from touren where id=v_tour)),
    ('fremd','liest Teilnehmer',          false, exists(select 1 from teilnehmer where tour_id=v_tour)),
    ('fremd','liest Stops',               false, exists(select 1 from tour_kneipen where tour_id=v_tour)),
    ('fremd','liest Challenges',          false, exists(select 1 from kneipen_challenge where tour_id=v_tour)),
    ('fremd','liest Ergebnisse',          false, exists(select 1 from ergebnisse where tour_id=v_tour)),
    ('fremd','darf werten',               false, darf_werten(v_tn_anna)),
    ('fremd','ist Host',                  false, ist_host(v_tour)),
    ('fremd','gehoert zur Tour',          false, darf_tour(v_tour)),
    -- Die Vorschau ist Absicht: ohne sie bliebe die Lobby beim
    -- Einladungslink leer. Sie zeigt Name, Status und Anzahl – sonst nichts.
    ('fremd','sieht die Vorschau',        true,  exists(select 1 from tour_vorschau('ZZ-RLSTEST')));

  begin
    insert into ergebnisse (tour_id, tour_kneipe_id, teilnehmer_id, schlucke, erledigt)
      values (v_tour, v_stop, v_tn_anna, 99, true);
    insert into t_pruef(bereich,fall,erwartet,ist) values ('fremd','schreibt Wertung',false,true);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('fremd','schreibt Wertung',false,false);
  end;

  begin
    insert into teilnehmer (tour_id, name, verwaltet_von) values (v_tour,'Eindringling',v_fremd);
    insert into t_pruef(bereich,fall,erwartet,ist) values ('fremd','schmuggelt Gast in fremde Runde',false,true);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('fremd','schmuggelt Gast in fremde Runde',false,false);
  end;

  -- Bars: unabhaengig von der Tour-Mitgliedschaft
  insert into t_pruef(bereich,fall,erwartet,ist) values
    ('bars','Fremder sieht oeffentliche Bar', true,  exists(select 1 from bars where id=v_bar_oeff)),
    ('bars','Fremder sieht private Bar',      false, exists(select 1 from bars where id=v_bar_priv));

  -- ═══════════════════════════════════════════════════════════════
  -- ANNA – Konto in der Runde, mit eigenem Gast
  -- ═══════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', v_anna)::text, true);

  insert into t_pruef(bereich,fall,erwartet,ist) values
    ('anna','liest die Tour',        true,  exists(select 1 from touren where id=v_tour)),
    ('anna','sieht alle 4 Teilnehmer', true, (select count(*)=4 from teilnehmer where tour_id=v_tour)),
    ('anna','liest Stops',           true,  exists(select 1 from tour_kneipen where tour_id=v_tour)),
    ('anna','liest Challenges',      true,  exists(select 1 from kneipen_challenge where tour_id=v_tour)),
    ('anna','wertet sich selbst',    true,  darf_werten(v_tn_anna)),
    ('anna','wertet ihren Gast',     true,  darf_werten(v_tn_gastA)),
    ('anna','wertet fremden Gast',   false, darf_werten(v_tn_gastH)),
    ('anna','wertet den Host',       false, darf_werten(v_tn_host)),
    ('anna','ist Host',              false, ist_host(v_tour));

  begin
    insert into ergebnisse (tour_id, tour_kneipe_id, teilnehmer_id, schlucke, erledigt)
      values (v_tour, v_stop, v_tn_gastA, 2, true);
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','schreibt fuer eigenen Gast',true,true);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','schreibt fuer eigenen Gast',true,false);
  end;

  begin
    insert into ergebnisse (tour_id, tour_kneipe_id, teilnehmer_id, schlucke, erledigt)
      values (v_tour, v_stop, v_tn_anna, 3, true);
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','schreibt fuer sich selbst',true,true);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','schreibt fuer sich selbst',true,false);
  end;

  begin
    insert into ergebnisse (tour_id, tour_kneipe_id, teilnehmer_id, schlucke, erledigt)
      values (v_tour, v_stop, v_tn_host, 42, true);
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','schreibt fuer den Host',false,true);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','schreibt fuer den Host',false,false);
  end;

  begin
    insert into teilnehmer (tour_id, name, verwaltet_von) values (v_tour,'Annas 2. Gast',v_anna);
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','legt weiteren Gast an',true,true);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','legt weiteren Gast an',true,false);
  end;

  begin
    insert into teilnehmer (tour_id, name, verwaltet_von) values (v_tour,'Untergeschoben',v_host);
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','legt Gast auf fremdes Konto an',false,true);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','legt Gast auf fremdes Konto an',false,false);
  end;

  begin
    update tour_kneipen set name='gekapert' where id=v_stop;
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','aendert die Route',false,found);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','aendert die Route',false,false);
  end;

  begin
    update touren set status='beendet' where id=v_tour;
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','beendet die Tour',false,found);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','beendet die Tour',false,false);
  end;

  begin
    delete from teilnehmer where id=v_tn_host;
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','wirft den Host raus',false,found);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','wirft den Host raus',false,false);
  end;

  begin
    delete from teilnehmer where id=v_tn_gastA;
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','entfernt eigenen Gast',true,found);
    -- `ergebnisse.teilnehmer_id` haengt per ON DELETE CASCADE dran: Mit dem
    -- Gast verschwinden auch seine Wertungen. Wichtig zu wissen, weil das
    -- waehrend eines laufenden Abends die Rangliste veraendert – und weil
    -- genau das beim ersten Lauf dieses Tests eine spaetere Pruefung
    -- umgeworfen hat.
    insert into t_pruef(bereich,fall,erwartet,ist) values
      ('anna','Wertungen verschwinden mit dem Gast', true,
       not exists(select 1 from ergebnisse where teilnehmer_id=v_tn_gastA));
    -- zurueckdrehen, die folgenden Pruefungen brauchen ihn noch
    insert into teilnehmer (id, tour_id, name, verwaltet_von)
      values (v_tn_gastA, v_tour, 'Gast/Anna', v_anna);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','entfernt eigenen Gast',true,false);
  end;

  -- Bar-Empfehlung: die Insert-Policy prueft per Unterabfrage auf
  -- `teilnehmer` – laeuft seit 12 also durch deren RLS.
  begin
    insert into tour_kneipen (tour_id, name, lat, lng, position, bar_id)
      values (v_tour, 'ZZ Bar-Stop', 50.73, 7.10, 1, v_bar_oeff);
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','fuegt Stop hinzu',false,true);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('anna','fuegt Stop hinzu',false,false);
  end;

  -- ═══════════════════════════════════════════════════════════════
  -- BEN – tritt per Code bei (Henne-Ei: vorher darf er nichts sehen)
  -- ═══════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', v_ben)::text, true);

  insert into t_pruef(bereich,fall,erwartet,ist) values
    ('beitritt','vorher: Tour lesbar',      false, exists(select 1 from touren where id=v_tour)),
    ('beitritt','vorher: Vorschau sichtbar', true, exists(select 1 from tour_vorschau('ZZ-RLSTEST'))),
    ('beitritt','Vorschau zaehlt Teilnehmer', true,
      (select anzahl_teilnehmer >= 4 from tour_vorschau('ZZ-RLSTEST')));

  -- Kleinschreibung und Leerzeichen muessen greifen: so tippt man Codes ab.
  v_tn_ben := tour_beitreten('  zz-rlstest  ', '  Ben  ');

  insert into t_pruef(bereich,fall,erwartet,ist) values
    ('beitritt','Beitritt liefert eine ID',  true, v_tn_ben is not null),
    ('beitritt','Name wird getrimmt',        true, (select name='Ben' from teilnehmer where id=v_tn_ben)),
    ('beitritt','nachher: Tour lesbar',      true, exists(select 1 from touren where id=v_tour)),
    ('beitritt','nachher: Stops lesbar',     true, exists(select 1 from tour_kneipen where tour_id=v_tour)),
    ('beitritt','nachher: Ergebnisse lesbar',true, exists(select 1 from ergebnisse where tour_id=v_tour)),
    ('beitritt','wertet sich selbst',        true, darf_werten(v_tn_ben)),
    ('beitritt','wertet Annas Gast nicht',   false, darf_werten(v_tn_gastA)),
    ('beitritt','zweimal beitreten ist idempotent', true,
      v_tn_ben = tour_beitreten('ZZ-RLSTEST','Ben')),
    ('beitritt','kein Doppel-Teilnehmer',    true,
      (select count(*)=1 from teilnehmer where tour_id=v_tour and user_id=v_ben));

  begin
    perform tour_beitreten('GIBTSNICHT','X');
    insert into t_pruef(bereich,fall,erwartet,ist) values ('beitritt','falscher Code scheitert',true,false);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('beitritt','falscher Code scheitert',true,true);
  end;

  -- ═══════════════════════════════════════════════════════════════
  -- HOST – darf alles in seiner Runde
  -- ═══════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', v_host)::text, true);

  insert into t_pruef(bereich,fall,erwartet,ist) values
    ('host','liest die Tour',        true, exists(select 1 from touren where id=v_tour)),
    ('host','ist Host',              true, ist_host(v_tour)),
    ('host','wertet eigenen Gast',   true, darf_werten(v_tn_gastH)),
    ('host','korrigiert Annas Gast', true, darf_werten(v_tn_gastA)),
    ('host','korrigiert Anna',       true, darf_werten(v_tn_anna)),
    ('host','sieht eigene private Bar', true, exists(select 1 from bars where id=v_bar_priv));

  begin
    update tour_kneipen set name='Teststop (Host)' where id=v_stop;
    insert into t_pruef(bereich,fall,erwartet,ist) values ('host','aendert die Route',true,found);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('host','aendert die Route',true,false);
  end;

  begin
    delete from teilnehmer where id=v_tn_anna;
    insert into t_pruef(bereich,fall,erwartet,ist) values ('host','entfernt einen Teilnehmer',true,found);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('host','entfernt einen Teilnehmer',true,false);
  end;

  -- ═══════════════════════════════════════════════════════════════
  -- BEENDETE RUNDE
  -- ═══════════════════════════════════════════════════════════════
  begin
    update touren set status='beendet' where id=v_tour;
    insert into t_pruef(bereich,fall,erwartet,ist) values ('host','beendet die Tour',true,found);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('host','beendet die Tour',true,false);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_fremd)::text, true);
  begin
    perform tour_beitreten('ZZ-RLSTEST','Nachzuegler');
    insert into t_pruef(bereich,fall,erwartet,ist) values ('beendet','Beitritt scheitert',true,false);
  exception when others then
    insert into t_pruef(bereich,fall,erwartet,ist) values ('beendet','Beitritt scheitert',true,true);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_ben)::text, true);
  insert into t_pruef(bereich,fall,erwartet,ist) values
    ('beendet','bleibt fuer Dabeigewesene lesbar', true, exists(select 1 from touren where id=v_tour));

  reset role;
end $$;

-- ── Ergebnis ─────────────────────────────────────────────────────
select nr, bereich, fall, erwartet, ist,
       case when erwartet = ist then 'ok' else '>>> FEHLER <<<' end as urteil
from t_pruef order by nr;

select count(*) filter (where erwartet <> ist) as fehler,
       count(*) as geprueft,
       case when count(*) filter (where erwartet <> ist) = 0
            then 'alle Pruefungen bestanden'
            else 'ACHTUNG: mindestens eine Policy verhaelt sich falsch'
       end as urteil
from t_pruef;

-- Nichts von alldem bleibt zurück – auch nicht die Testkonten.
rollback;

-- ── Notausgang ───────────────────────────────────────────────────
-- Falls das ROLLBACK oben nicht greift (manche Werkzeuge zerlegen ein
-- Skript in Einzelanweisungen und committen jede für sich), räumen diese
-- drei Zeilen von Hand auf. Alle Testdaten tragen dafür das Präfix „ZZ".
--
--   delete from touren     where code  like 'ZZ-%';
--   delete from bars       where name  like 'ZZ %';
--   delete from auth.users where email like '%@rls-test.invalid';
--
-- Danach zur Sicherheit zählen:
--   select (select count(*) from touren where code like 'ZZ-%') as reste_touren,
--          (select count(*) from bars where name like 'ZZ %')   as reste_bars,
--          (select count(*) from auth.users
--            where email like '%@rls-test.invalid')             as reste_konten;
