-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Seed: Hamburg & Düsseldorf (v3.3)
-- Fügt zwei Städte + kuratierte, gemischte Kneipen/Bars hinzu.
-- Koordinaten sind bewusst nah am jeweiligen Viertel gesetzt und lassen
-- sich in Supabase (Table Editor → kneipen_vorlage) oder über die
-- Karten-Feinjustierung exakt nachziehen.
-- In Supabase: SQL Editor → einfügen → RUN. Mehrfach ausführbar.
-- ════════════════════════════════════════════════════════════════

insert into staedte (name, slug, lat, lng, zoom) values
  ('Hamburg',    'hamburg',     53.5497, 9.9631, 15),
  ('Düsseldorf', 'duesseldorf', 51.2272, 6.7735, 16)
on conflict (slug) do nothing;

-- Doppelte Kneipen für diese Städte vermeiden (idempotent)
delete from kneipen_vorlage
where stadt_id in (select id from staedte where slug in ('hamburg', 'duesseldorf'));

insert into kneipen_vorlage (stadt_id, name, lat, lng, adresse, sortierung)
select s.id, v.name, v.lat, v.lng, v.adresse, v.sortierung
from staedte s
join (values
  -- HAMBURG (St. Pauli / Kiez / Schanze) – Mischung aus Kiez-Kneipe und Bar
  ('hamburg', 'Zur Ritze',        53.5497, 9.9622, 'Reeperbahn 140, 20359 Hamburg', 1),
  ('hamburg', 'Elbschlosskeller', 53.5494, 9.9639, 'Hamburger Berg 10, 20359 Hamburg', 2),
  ('hamburg', 'Silbersack',       53.5490, 9.9630, 'Silbersackstraße 9, 20359 Hamburg', 3),
  ('hamburg', 'La Paloma',        53.5487, 9.9635, 'Gerhardstraße 2, 20359 Hamburg', 4),
  ('hamburg', 'Grüner Jäger',     53.5566, 9.9647, 'Neuer Pferdemarkt 36, 20359 Hamburg', 5),
  ('hamburg', 'Aurel',            53.5624, 9.9614, 'Bartelsstraße 65, 20357 Hamburg', 6),
  -- DÜSSELDORF (Altstadt – „längste Theke der Welt")
  ('duesseldorf', 'Uerige',          51.2276, 6.7726, 'Berger Straße 1, 40213 Düsseldorf', 1),
  ('duesseldorf', 'Et Kabüffke',     51.2266, 6.7735, 'Flinger Straße 1, 40213 Düsseldorf', 2),
  ('duesseldorf', 'Zum Schlüssel',   51.2263, 6.7730, 'Bolkerstraße 41-47, 40213 Düsseldorf', 3),
  ('duesseldorf', 'Zum Uel',         51.2288, 6.7739, 'Ratinger Straße 16, 40213 Düsseldorf', 4),
  ('duesseldorf', 'Fattys Irish Pub', 51.2270, 6.7742, 'Hunsrückenstraße 13, 40213 Düsseldorf', 5),
  ('duesseldorf', 'Zum Schiffchen',  51.2258, 6.7717, 'Hafenstraße 5, 40213 Düsseldorf', 6)
) as v(stadt_slug, name, lat, lng, adresse, sortierung)
  on v.stadt_slug = s.slug;
