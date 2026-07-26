# Konzept: gespeicherte Routen, öffentlich & geteilt (v2.2)

_Stand: Juli 2026 · baut direkt auf `konzept-ugc-und-gameplay.md` auf_

Bars und Spiele sind seit v2.1 dauerhaft am Konto. Was fehlte, war das
Naheliegendste: **die Zusammenstellung selbst**. Wer eine gute Runde
gebaut hat, musste sie beim nächsten Mal neu klicken – und konnte sie
niemandem geben.

Dieses Dokument beschreibt die dritte UGC-Ebene: Routen speichern,
veröffentlichen, per Link teilen und in die eigene Liste übernehmen.

---

## 1. Architektur-Konzept

### 1.1 Eine Route ist eine Vorlage, kein Spiel

`touren` bleibt unverändert. Eine Route ist ausdrücklich **kein** halbes
Spiel, sondern nur eine benannte, geordnete Stopliste:

```
routen        (id, name, beschreibung, stadt_id, ersteller_user_id,
               sichtbarkeit, gesperrt, teilen_token, quelle_route_id)
routen_stops  (route_id, bar_id, name, lat, lng, adresse, position)
```

Diese Trennung ist der Grund, warum das Spielen einfach bleibt: Beim
Erstellen füllt die Route nur die Stopliste vor. Par, Glas, Modus und
Spielformen entscheidet man weiterhin pro Abend – dieselbe Route kann
morgen mit anderen Regeln gespielt werden, ohne Kopie und ohne Varianten.

### 1.2 Dasselbe Sichtbarkeitsmodell wie bei Bars

Kein neues Konzept, keine neuen Begriffe:

| Fall | `ersteller_user_id` | `sichtbarkeit` |
| --- | --- | --- |
| Selbst gebaut, privat | User-ID | `privat` |
| Selbst gebaut, veröffentlicht | User-ID | `oeffentlich` |
| Übernommen aus einem Link | User-ID (meine) | `privat` |

Auch die INSERT-Policy ist identisch: Routen entstehen **immer privat**,
Veröffentlichen ist ein bewusstes UPDATE. Wer im Eifer des Abends eine
Route sichert, veröffentlicht sie nicht versehentlich.

### 1.3 Stops sind Snapshot **und** Referenz – wie in `tour_kneipen`

`routen_stops` kopiert Name, Koordinaten und Adresse und hält zusätzlich
`bar_id`. Dieselbe Doppelung wie in der Route einer laufenden Tour, aus
demselben Grund: Das Löschen einer Bar zerstört keine gespeicherte Route
(`bar_id` wird `NULL`, der Stop bleibt vollständig), und die Referenz
sorgt dafür, dass Mitspieler:innen in der Session private Bars sehen
dürfen – die Session-Regel aus v2.1 greift unverändert weiter.

### 1.4 Teilen läuft über einen Token, nicht über eine Policy

Eine RLS-Policy sieht nur `auth.uid()`, nie den Link. Ein Token in einer
Policy müsste über eine Session-Variable gesetzt werden – umständlich und
leicht falsch zu benutzen. Deshalb hängt am Link ein `teilen_token` und
zwei eng geschnittene `security definer`-Funktionen erledigen den Rest:

| Funktion | darf | Rolle |
| --- | --- | --- |
| `route_per_token(token)` | genau diese Route + Stops zurückgeben | `anon`, `authenticated` |
| `route_uebernehmen(token, name)` | eine eigene Kopie anlegen | `authenticated` |

Zwei Dinge fallen dadurch von selbst richtig aus:

- **Die Vorschau funktioniert ohne Konto.** Ein geteilter Link zeigt
  erst, worum es geht, und lädt dann zum Anmelden ein – über
  `?weiter=`landet man danach exakt wieder auf der Route.
- **Es werden keine Rechte aufgeweicht.** Die Funktionen geben Route und
  Snapshots heraus, aber niemals Lesezugriff auf die `bars`-Tabelle des
  Absenders. Wer den Token nicht hat, sieht nichts.

Ein Link lässt sich zurückziehen, ohne die Route zu löschen:
`update routen set teilen_token = neuer_routen_token()`.

### 1.5 Bars beim Übernehmen: referenzieren, wo möglich – kopieren, wo nötig

Die Auflösung passiert bewusst **in der Datenbank**, nicht im Client, weil
sie über fremde private Daten entscheidet:

| Ausgangslage | Ergebnis |
| --- | --- |
| Bar ist öffentlich | bleibt referenziert – kein Duplikat |
| Bar gehört mir schon | bleibt referenziert |
| Bar ist fremd und privat | eigene private Kopie, `herkunft = 'uebernommen'` |
| Kopie existiert bereits | wird wiederverwendet (`quelle_bar_id`) |
| Stop ohne `bar_id` | bleibt reiner Snapshot |

Die Kopie ist keine Notlösung, sondern die ehrliche Variante: Eine fremde
private Bar bleibt privat – ich bekomme meine eigene, die ich umbenennen,
verschieben oder löschen kann, ohne dem Original zu schaden. Damit die
eigene Liste nachvollziehbar bleibt, trägt sie in der Bibliothek das
Symbol **übernommen**. `herkunft` ist dabei die Wahrheit für die Anzeige,
weil es das Löschen der Ursprungsbar überlebt; `quelle_bar_id` ist die
weiche Referenz, die Doppel-Importe verhindert.

`bars_quelle_pro_user` (unique, partial) erzwingt das: dieselbe Route
zweimal übernehmen erzeugt keine zweite Kopie derselben Bar.

### 1.6 Namen sind pro Spieler:in eindeutig – auf drei Ebenen

> „Routennamen dürfen pro Spieler nur einmal vergeben werden. Kriegt man
> eine Route geschickt und hat schon eine mit dem Namen, muss man
> umbenennen."

Diese Regel steht an drei Stellen, jede mit einer anderen Aufgabe:

1. **Datenbank** – `unique index routen_name_pro_user (ersteller_user_id,
   lower(name))`. Die Wahrheit. Gross-/Kleinschreibung zählt nicht als
   Unterschied, „Kölntour" und „kölntour" sind derselbe Name.
2. **RPC** – `route_uebernehmen` prüft vorher und antwortet freundlich
   mit `{ok:false, fehler:'name_belegt'}` statt mit einem Constraint-Fehler.
3. **UI** – `freierRoutenName()` schlägt beim Öffnen des Feldes bereits
   „Kölntour (2)" vor und zählt hoch, statt „(2) (2)" zu stapeln.

Der praktische Effekt: Die Regel wird fast nie als Fehler sichtbar. Man
tippt einmal auf „Übernehmen" und hat einen freien Namen – die harte
Prüfung greift nur, wenn zwei Tabs gleichzeitig offen sind.

---

## 2. Logik-Flow: vom Link zum Spiel

```
Link öffnen  /route/<token>
   └─ Vorschau (auch ohne Konto): Name, Beschreibung, Karte, Stopliste
        ├─ nicht angemeldet → „Anmelden & speichern"
        │                     → nach dem Login zurück auf denselben Link
        ├─ eigene Route      → Hinweis + Sprung in „Meine Routen"
        └─ angemeldet        → Namensfeld, vorbelegt mit freiem Vorschlag
              │
              └─ „Übernehmen"
                    ├─ Route wird als eigene, private Kopie angelegt
                    ├─ fremde private Bars werden mitkopiert (markiert)
                    └─ Abschluss mit zwei Wegen:
                          • „Direkt spielen"   → /create?route=<id>
                          • „Zu meinen Routen" → /dashboard?tab=routen
```

Und im Alltag, ganz ohne Link:

```
Hauptmenü „Spielen"
   └─ Karte „Nochmal spielen" (die letzten 4 eigenen Routen)
        └─ Tipp → /create?route=<id> → Stops sind gesetzt
             └─ „Spiel erstellen & Code generieren"
```

Drei Entscheidungen, die den Ablauf flüssig halten:

- **Routen werden dort gebaut, wo Stops entstehen** – in der
  Spielerstellung, mit Karte, Adresssuche und Bar-Picker. Ein zweiter
  Routen-Editor im Menü wäre doppelte Mechanik für dasselbe Ergebnis.
  Der Menüpunkt „Routen" verwaltet nur.
- **Laden verändert die gespeicherte Route nicht.** Im Formular ist die
  Stopliste danach frei bearbeitbar; wer die Änderung behalten will,
  drückt bewusst „aktualisieren" oder „Als neue Route".
- **Schnellstart steht im Spielen-Tab**, nicht im Routen-Tab. Wer spielen
  will, soll nicht erst verwalten müssen.

---

## 3. Umsetzungsschritte

### 3.1 Datenbank (einmalig in Supabase)

`supabase/routen_teilen.sql` im SQL-Editor ausführen – **nach**
`ugc_bars_spiele.sql`. Das Skript ist idempotent und additiv.

Es legt an bzw. ändert:

1. `bars.herkunft` + `bars.quelle_bar_id` (+ partial unique index)
2. `routen` (+ `routen_name_pro_user`, Indizes, `geaendert_am`-Trigger)
3. `routen_stops`
4. RLS-Policies für `routen` und `routen_stops`
5. `neuer_routen_token()`
6. `route_per_token(text)` – Vorschau, für `anon` freigegeben
7. `route_uebernehmen(text, text)` – Übernahme, nur `authenticated`

### 3.2 Frontend

| Datei | Änderung |
| --- | --- |
| `src/lib/types.ts` | Typen `Route`, `RoutenStop`, `BarHerkunft`; `Bar` um `herkunft`/`quelle_bar_id` erweitert |
| `src/lib/routen.ts` (neu) | einzige Zugriffsschicht: laden, speichern, aktualisieren, veröffentlichen, löschen, sperren, `teilenUrl`, `routeVorschau`, `routeUebernehmen`, `freierRoutenName` |
| `src/components/RoutenBibliothek.tsx` (neu) | `RoutenAnsicht`: eigene Routen (teilen, umbenennen, veröffentlichen, löschen, spielen) + Community-Liste mit Übernahme |
| `src/app/route/[token]/page.tsx` (neu) | Landeseite des geteilten Links: Vorschau, Login-Weiche, Übernahme, Weiterleitung ins Spiel |
| `src/components/Icons.tsx` | `IconRoute`, `IconTeilen`, `IconKopieren`, `IconUebernommen` |
| `src/app/dashboard/page.tsx` | vier Tabs **Spielen / Routen / Bars / Spiele** (die Bibliothek aus v2.1 ist damit erstmals eingebunden), Schnellstart-Karte „Nochmal spielen", „Deine Spiele" heißt jetzt „Deine Touren" |
| `src/app/create/page.tsx` | „Gespeicherte Route laden" (Picker: Meine / Community), „Als Route speichern" mit Namensprüfung, Schnellstart über `?route=<id>`, Import-Symbol im Bar-Picker |
| `src/components/Bibliothek.tsx` | Chip **übernommen** an Bars aus geteilten Routen |
| `src/components/Guard.tsx`, `src/app/auth/page.tsx` | `?weiter=`: nach dem Anmelden zurück auf das ursprüngliche Ziel (nur interne Pfade) |

### 3.3 Reihenfolge beim Deployen

1. `supabase/ugc_bars_spiele.sql` ausführen (falls noch nicht geschehen).
2. `supabase/routen_teilen.sql` ausführen.
3. Deploy. Ohne Schritt 2 bleibt der Routen-Tab leer, der Rest läuft weiter.

### 3.4 Rauchtest auf der Live-URL

1. **Hauptmenü** zeigt vier Tabs: Spielen · Routen · Bars · Spiele.
2. **Spiel erstellen** → Stadt wählen → unten „Als Route speichern" →
   Name vergeben → Meldung „liegt jetzt unter Routen".
3. Denselben Namen ein zweites Mal speichern → Feld schlägt „… (2)" vor,
   Speichern ist bis dahin gesperrt.
4. Tab **Routen** → Route aufklappen → „Link teilen" → Link kopieren.
5. Link im **zweiten Konto** öffnen: Vorschau erscheint (auch abgemeldet),
   nach dem Anmelden landet man wieder auf der Route.
6. Dort einen bereits belegten Namen eintippen → Vorschlag erscheint →
   „Übernehmen" → Route liegt unter „Meine Routen".
7. Tab **Bars** im zweiten Konto: die privaten Bars des Absenders stehen
   dort als eigene Bars mit Chip **übernommen**.
8. Denselben Link erneut übernehmen → es entstehen **keine** doppelten Bars.
9. Tab **Spielen** → Karte „Nochmal spielen" → Tipp auf die Route →
   Stops sind gesetzt → Spiel erstellen → Loop läuft wie in v2.1.

---

## 4. Bewusste Auslassungen

- **Keine Route-Version­ierung.** Wer eine übernommene Route ändert,
  ändert seine Kopie. Ein „das Original wurde aktualisiert"-Hinweis
  bräuchte Diffing und Konfliktauflösung – viel Mechanik für einen
  seltenen Fall. `quelle_route_id` liegt für später bereit.
- **Keine Einstellungen in der Route.** Par, Strafpunkte, Glas und
  Spielformen bleiben bewusst am Abend, nicht an der Vorlage. Sonst
  entstehen „dieselbe Route, aber mit anderem Par"-Duplikate.
- **Kein Melden von Routen.** Gesperrte Routen kann die Moderation
  bereits per `gesperrt` aus dem Verkehr ziehen; ein eigenes
  Meldeformular lohnt erst, wenn die Community-Liste wirklich wächst.
  Die Bars darin sind über `bar_meldungen` weiterhin meldbar.
- **Kein Sortieren/Filtern der Community-Liste.** Bei zweistelligen
  Zahlen ist eine Liste nach letzter Änderung ehrlicher als eine
  Rangfolge, die niemand füttert.
