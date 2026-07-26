# Dokumentation

Vier Dokumente, jedes mit einer klaren Aufgabe. Wer neu dazukommt, liest
`projektkonzept.md` und dann das Architekturdokument zum Bereich, an dem
er arbeitet.

| Dokument | Beantwortet |
| --- | --- |
| [`projektkonzept.md`](./projektkonzept.md) | Was ist das Spiel, für wen, mit welchen Grundsatzentscheidungen? |
| [`architektur-bars-und-spiele.md`](./architektur-bars-und-spiele.md) | Wie werden Bars und Spielformen gespeichert, wem gehören sie, wer darf was? Und wie läuft der Gameplay-Loop? (v2.1) |
| [`architektur-routen.md`](./architektur-routen.md) | Wie werden ganze Routen gespeichert, veröffentlicht, geteilt und übernommen? (v2.2) |
| [`architektur-beliebtheit.md`](./architektur-beliebtheit.md) | Wie entsteht der Beliebtheitsindex einer Bar und warum ist er so schmal? (v2.3) |
| [`roadmap.md`](./roadmap.md) | Was steht als Nächstes an? |

Die drei Architekturdokumente bauen aufeinander auf und benutzen dasselbe
Vokabular: `sichtbarkeit` (privat/öffentlich), `gesperrt` als
Moderationsbremse, Snapshot **und** Referenz für alles, was in einer Tour
landet. Wer eines gelesen hat, versteht die anderen schneller.

Für die Datenbank – Reihenfolge der Skripte, Seeds, Fallstricke – gibt es
eine eigene Übersicht: [`../supabase/README.md`](../supabase/README.md).

## Archiv

`archiv/` enthält abgeschlossene Dokumente, die nur noch historisch
interessant sind: die Release-Notiz zu v1.8 und den Umsetzungsplan, dessen
Punkte inzwischen umgesetzt oder in die Roadmap gewandert sind. Sie werden
nicht mehr gepflegt.
