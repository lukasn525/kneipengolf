# Dokumentation

Wer neu dazukommt, liest `projektkonzept.md` und dann das Architekturdokument zu
dem Bereich, an dem er arbeitet.

| Dokument | Beantwortet |
| --- | --- |
| [`projektkonzept.md`](./projektkonzept.md) | Was ist das Spiel, für wen, mit welchen Grundsatzentscheidungen? |
| [`architektur-bars-und-spiele.md`](./architektur-bars-und-spiele.md) | Wie werden Bars und Spielformen gespeichert, wem gehören sie, wer darf was? Und wie läuft der Gameplay-Loop? (v2.1) |
| [`architektur-routen.md`](./architektur-routen.md) | Wie werden ganze Routen gespeichert, veröffentlicht, geteilt und übernommen? (v2.2) |
| [`architektur-beliebtheit.md`](./architektur-beliebtheit.md) | Wie entsteht der Beliebtheitsindex einer Bar und warum ist er so schmal? (v2.3) |
| [`roadmap.md`](./roadmap.md) | Wohin geht das Produkt? |
| [`design-sheet.html`](./design-sheet.html) | Bausteine und Screens der Clubhouse-Palette. Im Browser öffnen. |
| [`kartenstile-vergleich.html`](./kartenstile-vergleich.html) | 17 Kartenstile nebeneinander, mit echten Pins und Route. Im Browser öffnen, nicht in einer Vorschau – die Kacheln kommen aus dem Netz. |

Die drei Architekturdokumente bauen aufeinander auf und benutzen dasselbe
Vokabular: `sichtbarkeit` (privat/öffentlich), `gesperrt` als
Moderationsbremse, Snapshot **und** Referenz für alles, was in einer Tour
landet. Wer eines gelesen hat, versteht die anderen schneller.

Für die Datenbank – Reihenfolge der Skripte, Seeds, Fallstricke – gibt es
eine eigene Übersicht: [`../supabase/README.md`](../supabase/README.md).
Für die Tests: [`../tests/README.md`](../tests/README.md).

## Zwei Listen, zwei Aufgaben

`roadmap.md` beantwortet **wohin** – Versionen, Auslöser, bewusst Verschobenes.
Sie ändert sich selten.

Was **diese Woche** ansteht, steht nicht hier, sondern im Claude-Projekt unter
`claude/todo.md`. Diese Liste wird zu Beginn jeder Sitzung gelesen und am Ende
nachgezogen. Wer beide Listen pflegt, pflegt am Ende keine – deshalb die klare
Trennung.

## Archiv

`archiv/` enthält abgeschlossene Dokumente, die nur noch historisch
interessant sind: die Release-Notiz zu v1.8 und den Umsetzungsplan, dessen
Punkte inzwischen umgesetzt oder in die Roadmap gewandert sind. Sie werden
nicht mehr gepflegt.
