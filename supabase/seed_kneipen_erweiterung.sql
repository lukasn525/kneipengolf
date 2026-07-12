-- ════════════════════════════════════════════════════════════════
-- Kneipen-Golf – Kneipen-Erweiterung (v3.5)
-- Ergänzt bestehende Städte um weitere echte Kneipen/Bars, damit beim
-- Erstellen immer 9 Stops standardmäßig geladen werden können und die
-- Auswahlliste genug Auswahl bietet.
-- Koordinaten sind viertelgenau ("nah dran") und lassen sich per
-- Pin-Drag beim Erstellen oder im Supabase Table Editor exakt justieren.
-- Idempotent: löscht die hier eingefügten Namen vorher.
-- ════════════════════════════════════════════════════════════════

delete from kneipen_vorlage where name in (
  'Lommerzheim','Gaffel Haus','Papa Joes Klimperkasten','Gilden im Zims',
  'Sünner im Walfisch','Bei Oma Kleinmann',
  'Füchschen','Kürzer','Brauerei Schumacher','Goldenes Einhorn','En de Canon','Weinhaus Tante Anna',
  'Molotow','Golden Pudel Club','Hasenschaukel','Barbarabar','Komet','Zoe Bar',
  'Fiddlers Irish Pub','Nyx Bar'
);

insert into kneipen_vorlage (stadt_id, name, lat, lng, adresse, sortierung)
select s.id, v.name, v.lat, v.lng, v.adresse, v.sortierung
from staedte s
join (values
  -- KÖLN (Altstadt / Zülpicher)
  ('koeln', 'Lommerzheim',            50.9330, 6.9718, 'Siegburger Str. 74, 50679 Köln', 8),
  ('koeln', 'Gaffel Haus',            50.9383, 6.9606, 'Alter Markt 20-22, 50667 Köln', 9),
  ('koeln', 'Papa Joes Klimperkasten',50.9385, 6.9609, 'Alter Markt 50-52, 50667 Köln', 10),
  ('koeln', 'Gilden im Zims',         50.9366, 6.9601, 'Heumarkt 25, 50667 Köln', 11),
  ('koeln', 'Sünner im Walfisch',     50.9372, 6.9614, 'Salzgasse 13, 50667 Köln', 12),
  ('koeln', 'Bei Oma Kleinmann',      50.9281, 6.9351, 'Zülpicher Str. 9, 50674 Köln', 13),
  -- DÜSSELDORF (Altstadt)
  ('duesseldorf', 'Füchschen',           51.2288, 6.7730, 'Ratinger Str. 28, 40213 Düsseldorf', 7),
  ('duesseldorf', 'Kürzer',              51.2262, 6.7726, 'Kurze Str. 18-20, 40213 Düsseldorf', 8),
  ('duesseldorf', 'Brauerei Schumacher', 51.2260, 6.7736, 'Bolkerstraße 44, 40213 Düsseldorf', 9),
  ('duesseldorf', 'Goldenes Einhorn',    51.2284, 6.7742, 'Ratinger Straße 18, 40213 Düsseldorf', 10),
  ('duesseldorf', 'En de Canon',         51.2255, 6.7728, 'Zollstraße 7, 40213 Düsseldorf', 11),
  ('duesseldorf', 'Weinhaus Tante Anna', 51.2266, 6.7748, 'Andreasstraße 2, 40213 Düsseldorf', 12),
  -- HAMBURG (St. Pauli / Kiez)
  ('hamburg', 'Molotow',          53.5497, 9.9628, 'Nobistor 14, 22767 Hamburg', 7),
  ('hamburg', 'Golden Pudel Club',53.5460, 9.9585, 'Fischmarkt 27, 20359 Hamburg', 8),
  ('hamburg', 'Hasenschaukel',    53.5489, 9.9629, 'Silbersackstraße 17, 20359 Hamburg', 9),
  ('hamburg', 'Barbarabar',       53.5498, 9.9605, 'Detlev-Bremer-Str. 15, 20359 Hamburg', 10),
  ('hamburg', 'Komet',            53.5493, 9.9642, 'Erichstraße 11, 20359 Hamburg', 11),
  ('hamburg', 'Zoe Bar',          53.5560, 9.9615, 'Talstraße 9, 22767 Hamburg', 12),
  -- BONN (weitere)
  ('bonn', 'Fiddlers Irish Pub', 50.7300, 7.0772, 'Frongasse 9, 53121 Bonn', 7),
  ('bonn', 'Nyx Bar',            50.7398, 7.0958, 'Maxstraße 22, 53111 Bonn', 8)
) as v(stadt_slug, name, lat, lng, adresse, sortierung)
  on v.stadt_slug = s.slug;
