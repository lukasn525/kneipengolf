# Kneipen-Golf – Umsetzungsplan: nächste Anpassungen

_Stand: Juli 2026 · Basis: vollständige Code- und Datenbank-Analyse der aktuellen Live-Version_

Dieses Dokument ist eine detaillierte, umsetzbare Arbeitsliste für die als Nächstes gewünschten
Anpassungen. Rechtliche Themen (Impressum, Datenschutz etc.) sind bewusst ausgenommen.

## Teststatus & wichtigste Befunde

- **Zugangssperre** (`casio2005`) ist live und funktioniert korrekt (jede Route wird abgefangen).
- **Städte in der DB:** nur **Bonn (6 Kneipen)** und **Köln (7 Kneipen)** – überwiegend Brauhäuser.
- **RLS:** Die verschärfte, mitgliedschaftsbasierte Row-Level-Security (`02_rls_verschaerfen.sql`)
  ist aktiv (`tk_lesen`, `tk_host`, `tn_lesen`, `tn_beitreten`, `tn_verwalten`, `er_mitglied`,
  Funktion `darf_tour`). Das ist der Hauptgrund, warum das Zusammenspielen aktuell hakt (siehe 1).
- **Nicht testbar von hier:** echter Mehrgeräte-Multiplayer (bräuchte einen zweiten Spiel-Account).
  Die Diagnose zu Punkt 1 beruht auf Code-/DB-Analyse, nicht auf einem Live-Zwei-Geräte-Test.

---

## 1. Multiplayer / „Zusammenspielen" reparieren

**Symptom:** Mehrere Personen auf verschiedenen Geräten sehen sich nicht bzw. Wertungen
synchronisieren nicht.

### Ursachen (aus Code + aktiver RLS)

1. **Mitgliedschafts-RLS blockiert die Lobby vor dem Beitreten.** `teilnehmer`, `tour_kneipen`,
   `kneipen_challenge`, `ergebnisse` sind per `darf_tour(tour_id)` geschützt. Ein neu über den Link
   gekommener Gast ist noch kein Mitglied → `darf_tour` = false → er sieht die Lobby leer und kann
   die Route/Challenges nicht laden, bis er sich selbst einträgt. Das wirkt „kaputt".
2. **Kontozwang + Zugangscode als doppelte Hürde.** `TourPage` ist in `Guard` gewickelt: jede:r
   Mitspieler:in braucht ein eigenes Konto **und** den Zugangscode. Für spontane Runden ist das zu
   viel Reibung – viele „spielen einfach nicht mit".
3. **Realtime hängt an der RLS.** Supabase-`postgres_changes` liefert nur Änderungen, die der/die
   Abonnent:in per SELECT sehen darf. Solange 1. nicht gelöst ist, kommen bei Gästen keine Events an.
4. **Prüfen:** Ist Realtime im Projekt aktiv? Die Tabellen sind zwar in `supabase_realtime`
   publiziert, aber die Replikation muss im Projekt eingeschaltet sein.

### Umsetzung – Variante A (schnell, empfohlen für privaten Freundeskreis)

Da die ganze Seite jetzt ohnehin hinter Zugangscode **und** Login liegt, bringt die fein
granulare Pro-Tour-RLS wenig Sicherheit, aber viel Fragilität. Zurück auf offene
„authenticated"-Policies:

```sql
-- In Supabase: SQL Editor. Ersetzt die Mitgliedschafts-Policies durch offene.
drop policy if exists "tk_lesen" on tour_kneipen;
drop policy if exists "tk_host"  on tour_kneipen;
drop policy if exists "kc_lesen" on kneipen_challenge;
drop policy if exists "kc_host"  on kneipen_challenge;
drop policy if exists "tn_lesen" on teilnehmer;
drop policy if exists "tn_beitreten" on teilnehmer;
drop policy if exists "tn_verwalten" on teilnehmer;
drop policy if exists "er_mitglied" on ergebnisse;

create policy "tk_alle" on tour_kneipen      for all to authenticated using (true) with check (true);
create policy "tn_alle" on teilnehmer        for all to authenticated using (true) with check (true);
create policy "kc_alle" on kneipen_challenge for all to authenticated using (true) with check (true);
create policy "er_alle" on ergebnisse        for all to authenticated using (true) with check (true);
```

Danach in Supabase unter **Database → Replication / Publications** prüfen, dass `ergebnisse`,
`teilnehmer`, `touren`, `kneipen_challenge` für Realtime aktiv sind.

### Umsetzung – Variante B (sauber, falls RLS bleiben soll)

- `teilnehmer` und `tour_kneipen`/`kneipen_challenge` **SELECT für alle Authentifizierten** öffnen
  (Lobby vor Beitritt sichtbar), nur INSERT/UPDATE/DELETE über `darf_tour` bzw. Host beschränken.
- Optional **Supabase Anonymous Auth** aktivieren, damit Gäste ohne Registrierung per Code
  beitreten können (`supabase.auth.signInAnonymously()` beim Öffnen von `/tour/CODE`). Das entfernt
  Ursache 2 und ist der größte Hebel für „mehr Leute spielen mit".

### Akzeptanzkriterien

- Zwei verschiedene Geräte/Konten öffnen dieselbe Tour, sehen sich gegenseitig in der Lobby.
- Wertung auf Gerät A erscheint binnen ~1 s in der Live-Rangliste auf Gerät B.
- „Tour beenden" durch den Host wechselt auf allen Geräten zur Endauswertung.

---

## 2. Kneipen überarbeiten (echte Kneipen statt Brauhäuser)

**Ist:** Seed-Daten sind fast nur Brauhäuser (Früh, Sion, Päffgen, Bönnsch …).
**Ziel:** Kuratierte, gemischte Kneipen/Bars je Stadt, die zu einer Tour passen (kurze Wege,
tatsächlich existent, gute Reihenfolge).

### Umsetzung

1. Pro Stadt eine **neue, geprüfte Liste** mit 6–10 echten Kneipen/Bars erstellen: Name, Adresse,
   und **korrekte Koordinaten** (per Geocoding, siehe Punkt 6). Mischung aus Bars, Kneipen,
   Cocktail-Läden – nicht nur Brauhäuser.
2. Alte Vorlagen ersetzen:
   ```sql
   delete from kneipen_vorlage where stadt_id in (select id from staedte where slug in ('bonn','koeln'));
   -- danach neue insert ... wie im Schema, aber mit kuratierten Kneipen + echten Koordinaten
   ```
3. Optional Feld `kategorie` (`bar` | `kneipe` | `cocktail` | `brauhaus`) und `notiz` ergänzen,
   um später filtern/anzeigen zu können:
   ```sql
   alter table kneipen_vorlage add column if not exists kategorie text;
   alter table kneipen_vorlage add column if not exists notiz text;
   ```
4. Koordinaten in Supabase (Table Editor) oder per Karten-Feinjustierung prüfen – aktuell sind
   einige Pins nur „nah dran".

### Akzeptanzkriterien

- Jede Stadt hat eine stimmige Liste realer Kneipen mit korrekten Pins auf der Karte.
- Reihenfolge ergibt eine sinnvoll begehbare Route (kurze Wege zwischen den Stops).

---

## 3. Route auf der Karte starten können

**Ist:** Die Karte erscheint erst **in** der laufenden Tour. Erstellung und Lobby zeigen nur Listen;
„starten" passiert über einen Button.
**Ziel:** Route schon beim Erstellen/​in der Lobby auf der Karte sehen und von dort starten.

### Umsetzung

1. In `src/app/create/page.tsx` die vorhandene `Map`-Komponente einbinden (dynamisch, `ssr:false`),
   die aktuellen `stops` als Marker anzeigen.
2. Optional eine **Routenlinie** zwischen den Stops zeichnen (Leaflet `Polyline` in `Map.tsx`
   ergänzen: `import { Polyline } from "react-leaflet"` und die Stop-Koordinaten in Reihenfolge).
3. Karten-Interaktion: Marker antippen = Stop markieren; Reihenfolge weiterhin per ▲▼.
4. „Route starten"-CTA direkt unter der Karte (führt wie bisher über Tour-Erstellung in die Lobby
   bzw. `status = 'laufend'`).

### Akzeptanzkriterien

- Beim Erstellen ist die Route live auf der Karte sichtbar und aktualisiert sich bei Änderungen.
- Ein sichtbarer „Route starten"-Button startet die Tour direkt aus der Kartenansicht.

---

## 4. Städte Hamburg & Düsseldorf hinzufügen

### Umsetzung (SQL-Seed)

```sql
insert into staedte (name, slug, lat, lng, zoom) values
  ('Hamburg',    'hamburg',    53.5511, 9.9937, 14),
  ('Düsseldorf', 'duesseldorf', 51.2277, 6.7735, 15)
on conflict (slug) do nothing;

-- danach je Stadt kuratierte Kneipen (echte Adressen + Koordinaten, siehe Punkt 2/6), z. B.:
insert into kneipen_vorlage (stadt_id, name, lat, lng, adresse, sortierung)
select s.id, v.name, v.lat, v.lng, v.adresse, v.sortierung
from staedte s
join (values
  ('duesseldorf', 'Uerige',            51.2270, 6.7720, 'Berger Str. 1, 40213 Düsseldorf', 1),
  ('duesseldorf', 'Zum Schlüssel',     51.2265, 6.7726, 'Bolkerstr. 41-47, 40213 Düsseldorf', 2)
  -- … weitere echte Kneipen der Düsseldorfer Altstadt ergänzen
) as v(stadt_slug, name, lat, lng, adresse, sortierung)
  on v.stadt_slug = s.slug;
-- Hamburg analog (z. B. Kiez/Schanze), Koordinaten per Geocoding prüfen.
```

### Akzeptanzkriterien

- Hamburg und Düsseldorf erscheinen in der Städte-Auswahl beim Erstellen.
- Beide haben eine kuratierte Route mit korrekten Karten-Pins.

---

## 5. Eigene Stadt / eigene Route erstellen

**Ist:** Man kann nur eine vordefinierte Stadt wählen. Eigene Stops sind möglich, landen aber am
Stadtzentrum mit Zufallsversatz (falsche Position). Ohne gewählte Stadt geht gar nichts
(`erstellen()` bricht bei `!stadt` ab; `stadt_id` ist zwar in der DB nullable).

**Ziel:** Modus „Eigene Stadt/Route" ganz ohne Vorlage: Name der Runde eingeben, Stops per
Adresssuche (Punkt 6) oder Kartenklick setzen.

### Umsetzung

1. In `create` eine Option **„Eigene Stadt / Route"** neben den vordefinierten Städten anbieten.
2. Bei diesem Modus:
   - `stadt_id = null` erlauben (DB unterstützt das bereits).
   - `erstellen()` anpassen: nicht mehr hart auf `stadt` prüfen, sondern auf
     „mindestens 1 Stop mit gültigen Koordinaten".
   - `tourCode()`-Präfix aus dem eingegebenen Rundennamen statt Stadtname bilden.
   - Karten-Center aus dem ersten Stop bzw. dem Mittel der Stops berechnen (statt Stadtzentrum);
     `tour/[code]` nutzt bereits `kneipen[0]` als Fallback-Center – für die Erstellung analog.
3. Stops setzen über: Adresssuche (Punkt 6) **oder** Klick/Long-Press auf die Karte (Leaflet
   `useMapEvents` → Koordinaten übernehmen, danach Adresse per Reverse-Geocoding auffüllen).

### Akzeptanzkriterien

- Eine Tour lässt sich komplett ohne vordefinierte Stadt erstellen und starten.
- Selbst gesetzte Stops sitzen an ihrer echten Position (nicht am Stadtzentrum).

---

## 6. Adresseingabe vereinfachen & validieren

**Ist:** `neuAdresse` ist reiner Freitext; Koordinaten werden **nicht** aus der Adresse ermittelt,
sondern auf Stadtzentrum + Zufallsversatz gesetzt (`eigeneHinzufuegen` in `create/page.tsx`).
Dadurch stimmen Pins eigener Kneipen nie.

**Ziel:** Adresse eintippen → echte Vorschläge (Autocomplete) → Auswahl setzt exakte
Koordinaten; ungültige Eingaben werden abgefangen.

### Umsetzung

1. **Geocoder anbinden.** Empfehlung: OpenStreetMap **Nominatim** (kostenlos) oder **Photon**
   (`photon.komoot.io`, autocomplete-freundlich). Beispiel-Request:
   ```
   https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=<Suchtext>
   ```
2. **Autocomplete-Feld** statt Freitext: Eingabe mit ~300 ms Debounce, Ergebnisliste als Dropdown
   (Name + Adresse). Auswahl übernimmt `lat`, `lng`, formatierte Adresse in den Stop.
3. **Validierung:** „Hinzufügen" erst aktiv, wenn ein Vorschlag mit gültigen Koordinaten gewählt
   wurde. Freitext ohne Treffer wird abgelehnt (Hinweis „Adresse nicht gefunden").
4. **Feinjustierung optional:** gesetzten Pin auf der Karte per Drag verschiebbar machen
   (Leaflet `Marker draggable` → `dragend` aktualisiert Koordinaten).
5. **Rahmenbedingungen beachten:** Nominatim erlaubt max. 1 Anfrage/Sekunde und verlangt einen
   aussagekräftigen `User-Agent`/`Referer` sowie Attribution. Für höheres Volumen einen eigenen
   Geocoding-Key (z. B. Photon self-hosted, Maptiler, LocationIQ) einplanen. Requests am besten
   über eine kleine **Next.js API-Route** proxen (Rate-Limit + Attribution zentral).

### Akzeptanzkriterien

- Beim Tippen einer Adresse erscheinen echte Vorschläge; Auswahl setzt den Pin exakt.
- Ohne gültige Auswahl lässt sich kein Stop mit falscher Position anlegen.

---

## Querschnitt / Voraussetzungen

- **Supabase-Env-Vars** müssen in Vercel gesetzt sein (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`), sonst läuft die App im Demo-Modus.
- **Zugangscode** ist über `SITE_ACCESS_CODE` in Vercel änderbar (Default `casio2005`).
- **Realtime** im Supabase-Projekt als aktiv verifizieren (Punkt 1).
- Neue SQL-Seeds am besten in eine versionierte Datei unter `supabase/` legen und dokumentieren,
  in welcher Reihenfolge sie laufen.

## Empfohlene Reihenfolge

1. **Multiplayer-Fix** (Punkt 1) – ohne funktionierendes Zusammenspiel bringt der Rest wenig.
2. **Adressvalidierung/Geocoding** (Punkt 6) – Voraussetzung für korrekte eigene Stops.
3. **Eigene Stadt/Route** (Punkt 5) und **Route auf Karte starten** (Punkt 3) – bauen auf 6 auf.
4. **Städte Hamburg/Düsseldorf** (Punkt 4) und **Kneipen überarbeiten** (Punkt 2) – Datenpflege,
   parallel möglich.
