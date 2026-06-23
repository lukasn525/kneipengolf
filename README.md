# 🍺 Kneipen-Challenge

Spiel dich mit Freunden durch die Kneipen – an jeder Station leerst du dein Getränk
mit so wenig Schlücken wie möglich, aber jedes Mal in einer anderen, zufällig
gezogenen Spielform. Eine Karte zeigt alle Kneipen, die Reihenfolge bestimmt ihr.

## Sofort ausprobieren (ohne Backend)

Die App läuft ohne Installation und ohne Datenbank – sie speichert dann lokal im
Browser. Wegen der ES-Module einen kleinen Webserver starten:

```bash
cd kneipen-challenge
python3 -m http.server 8000
# Browser: http://localhost:8000
```

Tippe auf einen Pin → Challenge wird gezogen → Schlücke zählen → erledigt markieren.
Der **Tour-Code** oben (z. B. `TOUR-7F3K`) steht auch in der URL (`…#TOUR-7F3K`).
Diesen Link teilen = gleiche Tour. (Geräteübergreifend erst mit Supabase, s. u.)

## Persistent speichern mit Supabase (Schritt 3)

1. Auf [supabase.com](https://supabase.com) kostenlos ein Projekt anlegen.
2. **SQL Editor** öffnen → Inhalt von `supabase/schema.sql` einfügen → **Run**.
   Das legt die Tabellen an und befüllt Spielformen + Beispiel-Kneipen.
3. **Project Settings → API**: *Project URL* und *anon public* Key kopieren.
4. In `js/config.js` eintragen:
   ```js
   export const SUPABASE_URL = "https://deinprojekt.supabase.co";
   export const SUPABASE_ANON_KEY = "dein-anon-key";
   ```
5. Seite neu laden – oben steht jetzt „Cloud-Speicher". Stände werden geräte-
   übergreifend über den Tour-Code geteilt.

## Eigene Kneipen eintragen (Schritt 5)

- **Mit Supabase:** in der Tabelle `kneipen` Zeilen ergänzen (Dashboard → Table Editor).
  Koordinaten findest du, indem du den Ort auf [openstreetmap.org](https://www.openstreetmap.org)
  rechtsklickst → „Adresse anzeigen" zeigt lat/lng.
- **Ohne Supabase:** Liste in `js/data.js` anpassen.

Spielformen erweiterst du analog in `spielformen` bzw. `js/data.js`.

## Veröffentlichen (Schritt 6)

Es ist eine statische Seite – einfach den Ordner zu **Netlify**, **Vercel** oder
**GitHub Pages** ziehen. Kein Build nötig.

## Projektstruktur

```
kneipen-challenge/
├── index.html              Einstiegspunkt (Karte + Challenge-Panel)
├── css/style.css           Tavernen-Nacht-Look, Bierdeckel-Challenge
├── js/
│   ├── config.js           Supabase-Keys + Startkoordinaten
│   ├── data.js             Lokale Beispieldaten (Fallback ohne Backend)
│   ├── store.js            Speicher: localStorage ODER Supabase
│   ├── game.js             Zufalls-Spielform + Statistik
│   ├── map.js              Leaflet-Karte & Marker
│   └── app.js              Verbindet alles
├── supabase/schema.sql     Tabellen + Beispieldaten für Supabase
└── docs/projektkonzept.md  Anforderungsanalyse & offene Fragen
```

## Tech-Stack (bewusst minimal)

| | Wahl | Kosten |
|---|---|---|
| Frontend | Reines HTML/CSS/JS, kein Build | – |
| Karte | Leaflet + OpenStreetMap | gratis, kein API-Key |
| Datenbank | Supabase (PostgreSQL) | Gratis-Tarif |
| Hosting | Netlify / Vercel / GitHub Pages | gratis |

Kein eigener Server: der Browser spricht Supabase direkt an.
