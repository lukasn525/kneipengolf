# Roadmap

_Leitprinzip: **einfach und schnell spielbar bleibt oberste Priorität.** Neue
Features nur, wenn sie den Kern nicht verkomplizieren. Erweiterte Optionen
immer „einen Tipp entfernt", nie im Hauptweg._

> Diese Liste beantwortet **wohin**. Was diese Woche ansteht, steht im
> Claude-Projekt unter `claude/todo.md`.

---

## Erledigt

Die Wege dorthin stehen in den Architekturdokumenten – hier nur der Stand.

| Version | Inhalt |
| --- | --- |
| v1.1–v1.7 | Erstellen entschlackt, Spielformen anpassbar, geführter Spiel-Loop, Lobby mit QR und Teilen, Auswertung mit Sieger-Moment und Rematch, Icon-Set, Micro-Animationen, Skeletons, Offline-Cache für Route und Tourstand |
| v2.0 | Konto-Features: eigene Bars und Spielformen dauerhaft am Konto, Handicap und Statistiken |
| v2.1 | **UGC-Architektur:** `bars` als einzige Quelle der Wahrheit, Sichtbarkeit privat/öffentlich, Rollen und Moderation, Session-Sichtbarkeit |
| v2.2 | **Routen:** speichern, veröffentlichen, per Link teilen, übernehmen; Routen-Modus in der Erstellung; automatische Stadt-Erkennung; skalierender Stadt-Filter |
| v2.3 | **Beliebtheit:** Empfehlung nach dem Spiel, Index aus vier Signalen, Sortierung im Picker |
| v3.0 | **Oberfläche:** Bottom-Navigation mit eigenem Profil-Bereich, Trefferflächen ab 44 px, Kontraste angehoben, Palette „Clubhouse", `SeitenKopf` überall |
| v4.0 | **Erstellen in drei Schritten** (Route · Regeln · Übersicht); Regeln vollständig vorbelegt und überspringbar |
| v4.1 | **Tags für Bars** (Vokabular im Code, nicht in der Datenbank) und Kartenstil-Auswahl |
| v5.0 | **Zeilenschutz auf Mitgliedschaft:** Policies hängen an der Teilnahme statt an `using (true)`; Gäste gehören einem Konto (`verwaltet_von`) statt einer Geräte-ID; Beitritt über `tour_vorschau` / `tour_beitreten` |
| v5.1 | **Tests:** Vitest mit 88 Unit-Tests über `src/lib`, RLS als wiederholbares SQL mit 61 Prüfungen |
| v5.2 | **Karte als Bauteil:** heller Standardstil (Esri World Topo), gemeinsames `Kartenfeld` mit Rahmen, eigener Bedienung und Namens-Chip am Pin |

---

## Als Nächstes

- **Admin-Oberfläche für die Moderation.** Gemeldete Bars, sperren,
  Community-Bars adoptieren – heute drei SQL-Abfragen am Ende von
  `07_ugc_bars_spiele.sql`. Der Datenpfad steht bereits, es fehlt nur die
  Ansicht. Lohnt, sobald Meldungen regelmäßig auflaufen.
- **Altbestand entsorgen.** `meine_kneipen` und `meine_spielformen` sind
  seit v2.1 migriert und liegen nur noch als Sicherheitsnetz herum. Wenn
  die Migration im Alltag bestätigt ist:
  `drop table meine_kneipen, meine_spielformen;`
- **Rechtliches.** Impressum und Datenschutzerklärung fehlen. Spätestens
  nötig, bevor die Zugangssperre fällt.
- **Getrennte Umgebung für Previews.** Preview und Production hängen an
  derselben Supabase-Instanz; jeder Test schreibt in die echten Daten.
  Zweites Projekt plus eigene Env-Variablen pro Umgebung.

## Wenn es wächst

Diese Punkte sind heute bewusst nicht gebaut – die Auslöser stehen dabei.

- **Bars serverseitig filtern.** `ladeBars` holt alle sichtbaren Bars und
  filtert im Browser. *Auslöser:* spürbare Ladezeit in der Bibliothek,
  grob ab vierstelligen Bar-Zahlen. *Dann:* `stadt_id` in die Query,
  Zählung per `count`.
- **`bar_beliebtheit` materialisieren.** *Auslöser:* die View wird zum
  Flaschenhals, grob ab fünfstelligen Bar-Zahlen. *Dann:* materialized
  view mit nächtlichem Refresh – Rezept steht in `09_beliebtheit.sql`,
  das Frontend bleibt unverändert.
- **Freigabe-Warteschlange fürs Veröffentlichen.** *Auslöser:* die
  Nutzerzahl übersteigt den Freundeskreis. *Dann:* dritter Zustand
  `eingereicht` in `sichtbarkeit`; die Policies sind darauf vorbereitet.
- **Zeitverfall im Beliebtheitsindex.** *Auslöser:* alte Bars verdrängen
  dauerhaft neue. *Dann:* Gewichtung nach `erstellt_am` in der View, ohne
  Schemaänderung.
- **Eigene Kartengestaltung über Vektorkacheln.** *Auslöser:* der fertige
  Kachelstil trägt die Marke nicht mehr, oder Esri wird zum Problem – der
  Dienst steht in *mature support* und wird nicht mehr aktualisiert.
  *Dann:* OpenFreeMap plus eigene `style.json`; Anbieter, Lizenzen und
  Aufwand stehen im Claude-Projekt unter `claude/kartenstile-recherche.md`.

## Ideen ohne Termin

- **Bar aus einer Session übernehmen.** Wer bei einer fremden Tour eine
  gute private Bar sieht, kann sie heute nicht in seine Liste holen –
  die Referenz über `tour_kneipen.bar_id` läge bereit.
- **Routen-Versionierung.** „Das Original wurde aktualisiert" bei
  übernommenen Routen. Braucht Diffing und Konfliktauflösung;
  `routen.quelle_route_id` ist der Anknüpfungspunkt.
- **Kollaboratives Bearbeiten fremder Bars.** Heute meldet man eine
  falsche Position. Echtes Editieren bräuchte Versionierung.
- **Teams als eigenes Konzept** statt „ein Gerät = ein Team".
- **Verlaufs-Hinweis beim Routenbauen.** Die Kette der bisherigen
  Stimmungen zeigen und auf einseitige Abende hinweisen. Braucht erst
  einen getaggten Bestand.

---

## Querschnittlich, laufend

- **Schlechtes Netz ist der Normalfall.** Kneipen-WLAN ist unzuverlässig:
  optimistische Anzeige, Route und Tourstand cachen, Fehler sanft
  behandeln. Bei jeder neuen Funktion mitdenken.
- **Der Hauptweg bleibt kurz.** Jede neue Funktion muss sich fragen
  lassen, ob sie den Weg von „App öffnen" zu „erster Schluck gezählt"
  verlängert. Wenn ja: einen Tipp tiefer legen.
- **Policies werden geprüft, nicht geglaubt.** Nach jeder Änderung an
  einer Policy oder an `darf_tour` / `ist_host` / `darf_werten` läuft
  `supabase/tests/rls_test.sql`. Jede Regel braucht einen Erlaubt- **und**
  einen Verboten-Fall.
