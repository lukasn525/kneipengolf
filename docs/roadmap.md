# Roadmap

_Leitprinzip: **einfach und schnell spielbar bleibt oberste Priorität.** Neue
Features nur, wenn sie den Kern nicht verkomplizieren. Erweiterte Optionen
immer „einen Tipp entfernt", nie im Hauptweg._

---

## Erledigt

Die Wege dorthin stehen in den Architekturdokumenten – hier nur der Stand.

| Version | Inhalt |
| --- | --- |
| v1.1–v1.7 | Erstellen entschlackt, Spielformen anpassbar, geführter Spiel-Loop, Lobby mit QR und Teilen, Auswertung mit Sieger-Moment und Rematch, Icon-Set, Micro-Animationen, Skeletons, Offline-Cache für Route und Tourstand |
| v2.0 | Konto-Features: eigene Bars und Spielformen dauerhaft am Konto, Handicap und Statistiken |
| v2.1 | **UGC-Architektur:** `bars` als einzige Quelle der Wahrheit, Sichtbarkeit privat/öffentlich, Rollen und Moderation, Session-Sichtbarkeit, Pass-and-Play mit `geraet_id` |
| v2.2 | **Routen:** speichern, veröffentlichen, per Link teilen, übernehmen; Routen-Modus in der Erstellung; automatische Stadt-Erkennung; skalierender Stadt-Filter |
| v2.3 | **Beliebtheit:** Empfehlung nach dem Spiel, Index aus vier Signalen, Sortierung im Picker |

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

---

## Querschnittlich, laufend

- **Schlechtes Netz ist der Normalfall.** Kneipen-WLAN ist unzuverlässig:
  optimistische Anzeige, Route und Tourstand cachen, Fehler sanft
  behandeln. Bei jeder neuen Funktion mitdenken.
- **Der Hauptweg bleibt kurz.** Jede neue Funktion muss sich fragen
  lassen, ob sie den Weg von „App öffnen" zu „erster Schluck gezählt"
  verlängert. Wenn ja: einen Tipp tiefer legen.
