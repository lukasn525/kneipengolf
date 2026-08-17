# Tests

## Ausführen

```bash
npm test            # einmal durchlaufen
npm run test:watch  # beim Entwickeln mitlaufen lassen
npm run test:coverage
```

Die RLS-Regeln liegen nicht hier, sondern in `supabase/tests/rls_test.sql`.
Die kopiert man in den Supabase-SQL-Editor und drückt RUN — die Datei räumt
selbst auf und ändert nichts an den echten Daten.

## Was hier getestet wird — und was nicht

Nur `src/lib`: alles, was rechnet oder entscheidet, und zwar als reine
Funktionen ohne Netz, Browser oder Datenbank. Der ganze Lauf dauert unter
zwei Sekunden.

**Bewusst nicht getestet:** die React-Seiten. `tour/[code]/page.tsx` und
`Bibliothek.tsx` sind zusammen rund 2600 Zeilen UI mit Supabase-Aufrufen
darin. Komponententests dafür würden vor allem Mocks prüfen. Diese Ebene
gehört in einen Mehrgeräte-E2E-Test (siehe `claude/testkonzept.md`), nicht
hierher.

Ebenso nicht: die asynchronen Supabase-Funktionen in `beliebtheit.ts`. Was
sie tun dürfen, entscheiden die RLS-Policies — geprüft wird das dort.

## Aufbau

| Datei | Inhalt |
|---|---|
| `hilfen.ts` | Bausteine: `tour()`, `spieler()`, `gast()`, `wertung()`. Absichtlich winzig — ein Test soll lesbar sein, ohne diese Datei zu kennen. |
| `game.test.ts` | Die Wertung. Wichtigste Datei im Projekt. |
| `tags.test.ts` | Vokabular, Speicherregeln, Filter. |
| `beliebtheit.test.ts` | Stufen, Text, Sortierung. |
| `orte.test.ts` | Stadt-Erkennung über Name und Nähe. |
| `zugangscode.test.ts` | Code und Cookie-Vorgaben. |

## Der Testfall, auf den es ankommt

`game.test.ts` beginnt mit dem Fehler vom **16.08.2026**, der live war: Die
Nachrück-Regel griff auch für Stops, die eine Person noch gar nicht erreicht
hatte — der Live-Score sprang nach oben, sobald jemand anderes ein Loch
weiter war, und fiel wieder, wenn man aufschloss.

Ein Fehler, der einmal in Produktion stand, ist der wertvollste Testfall,
den es gibt. Gegengeprüft: Baut man den Fehler in `rangliste()` wieder ein,
werden zwei Tests rot.

## Wenn ein Test rot wird

Erst prüfen, ob die **Erwartung** noch stimmt. Beim ersten Lauf der
RLS-Datei war nicht die Policy falsch, sondern der Test: `ergebnisse` hängt
per `on delete cascade` am Teilnehmer, und ein gelöschter Gast nimmt seine
Wertungen mit. Das steht jetzt als eigene Prüfung drin.

Erst wenn die Erwartung stimmt, ist der Code dran.
