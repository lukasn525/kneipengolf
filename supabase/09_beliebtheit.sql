-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Beliebtheit von Bars (v2.3)
--
-- Ausführen NACH 08_routen_teilen.sql:
--   Supabase Dashboard → SQL Editor → New query → einfügen → RUN.
--
-- Das Skript ist idempotent und additiv.
--
-- Kernideen
--   • Der Index misst NICHT Qualität, sondern Zuspruch: Wie viele
--     verschiedene Menschen haben diese Bar empfohlen, dort gespielt,
--     in eine öffentliche Route gepackt oder in ihre Liste übernommen?
--   • Gezählt werden PERSONEN, nicht Ereignisse. Wer zehnmal dieselbe
--     Tour startet, erzeugt genau eine Stimme. Das ist der wichtigste
--     Schutz gegen Selbstbeweihräucherung.
--   • Explizite Empfehlungen entstehen nur nach einem echten Spiel –
--     die RLS-Policy verlangt Teilnahme an einer Tour, in der die Bar
--     tatsächlich vorkam. Man kann keine Bar „von aussen" hochvoten.
--   • Die Zahlen liegen in einer VIEW, nicht in Spalten an `bars`.
--     Keine Trigger, keine Sync-Fehler, keine veralteten Zähler.
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. Explizite Empfehlung: „diese Kneipe war top"
-- ════════════════════════════════════════════════════════════════
-- Eine Zeile pro Person und Bar. Wer dieselbe Bar in einer späteren
-- Tour nochmal empfiehlt, aktualisiert nur den Bezug – die Stimme
-- bleibt eine Stimme.
create table if not exists bar_empfehlungen (
  bar_id      uuid not null references bars(id)   on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Beleg, aus welchem Spiel die Empfehlung stammt. Verschwindet die
  -- Tour, verschwindet auch die Stimme: gezählt wird, was gespielt wurde.
  tour_id     uuid not null references touren(id) on delete cascade,
  erstellt_am timestamptz default now(),
  primary key (bar_id, user_id)
);

create index if not exists bar_empf_bar_idx  on bar_empfehlungen (bar_id);
create index if not exists bar_empf_tour_idx on bar_empfehlungen (tour_id);

alter table bar_empfehlungen enable row level security;

drop policy if exists "bar_empf_lesen"    on bar_empfehlungen;
drop policy if exists "bar_empf_neu"      on bar_empfehlungen;
drop policy if exists "bar_empf_aendern"  on bar_empfehlungen;
drop policy if exists "bar_empf_loeschen" on bar_empfehlungen;

-- Einzelstimmen sind privat: nur die eigene und die Moderation. Die
-- Öffentlichkeit sieht ausschliesslich die Summe in `bar_beliebtheit`.
create policy "bar_empf_lesen" on bar_empfehlungen
  for select to authenticated
  using (user_id = auth.uid() or ist_moderator());

-- Empfehlen darf nur, wer an dieser Tour teilgenommen hat UND bei wem
-- die Bar auch wirklich auf der Route stand.
create policy "bar_empf_neu" on bar_empfehlungen
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from teilnehmer tn
      where tn.tour_id = bar_empfehlungen.tour_id and tn.user_id = auth.uid()
    )
    and exists (
      select 1 from tour_kneipen tk
      where tk.tour_id = bar_empfehlungen.tour_id and tk.bar_id = bar_empfehlungen.bar_id
    )
  );

create policy "bar_empf_aendern" on bar_empfehlungen
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "bar_empf_loeschen" on bar_empfehlungen
  for delete to authenticated
  using (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- 2. Die View: vier Signale, eine Punktzahl
--
--    Gewichtung nach Aufwand und Aussagekraft:
--      Empfehlung   ×5  – bewusster Akt nach einem echten Abend
--      Gruppe       ×3  – jemand hat die Bar wirklich bespielt
--      Route        ×2  – jemand hält sie für vorzeigbar (öffentlich)
--      Übernahme    ×1  – jemand fand sie gut genug zum Behalten
--
--    Alle vier zählen DISTINCT Personen. Die View läuft bewusst mit
--    Eigentümerrechten und liefert nur Aggregate – nie erkennbar,
--    WER etwas empfohlen hat.
-- ════════════════════════════════════════════════════════════════
create or replace view bar_beliebtheit as
with empf as (
  select bar_id, count(distinct user_id) as n
  from bar_empfehlungen group by bar_id
),
gespielt as (
  select tk.bar_id,
         count(distinct t.id)            as touren,
         count(distinct t.host_user_id)  as gruppen
  from tour_kneipen tk
  join touren t on t.id = tk.tour_id
  where tk.bar_id is not null
    and t.status in ('laufend', 'beendet')
  group by tk.bar_id
),
in_routen as (
  select rs.bar_id, count(distinct r.ersteller_user_id) as n
  from routen_stops rs
  join routen r on r.id = rs.route_id
  where rs.bar_id is not null
    and r.sichtbarkeit = 'oeffentlich'
    and not r.gesperrt
  group by rs.bar_id
),
kopien as (
  select quelle_bar_id as bar_id, count(distinct ersteller_user_id) as n
  from bars
  where quelle_bar_id is not null
  group by quelle_bar_id
)
select
  b.id                              as bar_id,
  coalesce(e.n, 0)                  as empfehlungen,
  coalesce(g.touren, 0)             as touren,
  coalesce(g.gruppen, 0)            as gruppen,
  coalesce(r.n, 0)                  as routen,
  coalesce(k.n, 0)                  as uebernahmen,
  ( 5 * coalesce(e.n, 0)
  + 3 * coalesce(g.gruppen, 0)
  + 2 * coalesce(r.n, 0)
  + 1 * coalesce(k.n, 0) )          as punkte
from bars b
left join empf      e on e.bar_id = b.id
left join gespielt  g on g.bar_id = b.id
left join in_routen r on r.bar_id = b.id
left join kopien    k on k.bar_id = b.id;

-- Nur Aggregate, keine Identitäten – deshalb für alle Angemeldeten lesbar.
-- Wer die Bar selbst nicht sehen darf, kann mit der Zahl nichts anfangen:
-- `bars` bleibt unabhängig davon durch RLS geschützt.
grant select on bar_beliebtheit to authenticated;


-- ════════════════════════════════════════════════════════════════
-- 3. Nützliche Abfragen (bei Bedarf einzeln ausführen)
-- ════════════════════════════════════════════════════════════════
-- Beliebteste Bars einer Stadt:
--   select b.name, p.punkte, p.empfehlungen, p.gruppen
--   from bars b join bar_beliebtheit p on p.bar_id = b.id
--   where b.stadt_id = 1 and b.sichtbarkeit = 'oeffentlich'
--   order by p.punkte desc, b.name limit 20;
--
-- Kandidaten fürs kuratierte Set (Community-Bars mit Zuspruch):
--   select b.id, b.name, p.punkte
--   from bars b join bar_beliebtheit p on p.bar_id = b.id
--   where b.ersteller_user_id is not null and b.sichtbarkeit = 'oeffentlich'
--   order by p.punkte desc limit 20;
--
-- Wird die View zum Flaschenhals (grob ab fünfstelligen Bar-Zahlen),
-- wird daraus eine materialized view mit nächtlichem Refresh:
--   create materialized view bar_beliebtheit_mv as select * from bar_beliebtheit;
--   create unique index on bar_beliebtheit_mv (bar_id);
--   refresh materialized view concurrently bar_beliebtheit_mv;
