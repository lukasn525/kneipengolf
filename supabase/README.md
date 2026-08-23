# Datenbank – Reihenfolge und Zweck

Alle Skripte laufen im **Supabase SQL-Editor** (Dashboard → SQL Editor →
New query → einfügen → RUN). Sie sind **idempotent**: mehrfaches
Ausführen schadet nicht.

Die Nummern sind die Reihenfolge. Wer eine frische Datenbank aufsetzt,
arbeitet sie einmal von oben nach unten durch.

| # | Datei | Was es tut |
| --- | --- | --- |
| 01 | `01_schema.sql` | Grundschema: Städte, Kneipen-Vorlagen, Touren, Teilnehmer, Ergebnisse, Spielformen |
| 02 | `02_rls_verschaerfen.sql` | Erste, mitgliedschaftsbasierte RLS-Policies für die Spieltabellen |
| 03 | `03_multiplayer_fix_rls.sql` | Korrektur: setzt die Spieltabellen auf offene `authenticated`-Policies zurück (die Seite liegt bereits hinter Zugangscode + Login) |
| 04 | `04_add_spiel_modus.sql` | `touren.spiel_modus`: Einzel oder Team |
| 05 | `05_spielformen_snapshot.sql` | Challenge speichert Titel + Beschreibung als Momentaufnahme |
| 06 | `06_konto_features.sql` | `meine_kneipen`, `meine_spielformen` (seit 07 nur noch Altbestand) |
| 07 | `07_ugc_bars_spiele.sql` | **UGC-Architektur:** `bars` als einzige Quelle, Rollen, Sichtbarkeit, Moderation, Migration der Altbestände |
| 08 | `08_routen_teilen.sql` | **Routen:** speichern, veröffentlichen, per Link teilen, übernehmen; `touren.route_id` |
| 09 | `09_beliebtheit.sql` | **Beliebtheit:** `bar_empfehlungen` + View `bar_beliebtheit` |
| 10 | `10_aufraeumen.sql` | Entfernt `bars.kategorie` (abgelöst vom Tag-Konzept) |
| 11 | `11_tags.sql` | **Tags:** `bars.tags` als Array; Vokabular lebt in `src/lib/tags.ts` |
| 12 | `12_rls_mitgliedschaft.sql` | **Zeilenschutz auf Mitgliedschaft:** `darf_tour` / `ist_host` / `darf_werten`, `tour_vorschau`, `tour_beitreten`, Gäste mit `verwaltet_von` |
| 13 | `13_aufraeumen_geraet_id.sql` | Nachlauf zu 12: `teilnehmer.geraet_id` entfernen (erst nach bestätigtem Deploy) |
| 14 | `14_touren_lesen_returning.sql` | Korrektur: `touren_lesen` prüft den Host direkt, sonst scheitert „Spiel erstellen“ am eigenen `insert ... returning` |

## Prüfen

`tests/rls_test.sql` in den SQL-Editor kopieren und RUN drücken. **61 Prüfungen**
über alle Spieltabellen, jede mit einem Erlaubt- **und** einem Verboten-Fall. Die
letzte Ausgabe sagt „alle Pruefungen bestanden" oder nennt die Zeilen, die
abweichen.

Das Skript läuft in einer Transaktion, legt vier Wegwerf-Konten an und macht am
Ende alles rückgängig – eure Daten bleiben unberührt. Am Ende der Datei steht ein
Notausgang für den Fall, dass ein Werkzeug das ROLLBACK verschluckt.

**Wann ausführen:** nach jeder Änderung an einer Policy oder an
`darf_tour` / `ist_host` / `darf_werten` / `tour_beitreten`.

Getestet wird bewusst als `authenticated` mit gesetztem `request.jwt.claims`, nicht
als Datenbank-Eigentümer – der umgeht RLS, und ein Test als Eigentümer würde
fröhlich grün leuchten, während die Policies offen stehen.

## Seeds

`seeds/` enthält kuratierte Beispieldaten. Sie schreiben nach
`kneipen_vorlage` – der Tabelle **vor** der UGC-Umstellung.

> **Wichtig:** Seeds vor `07_ugc_bars_spiele.sql` einspielen. Wer sie
> später nachlegt, führt `07_ugc_bars_spiele.sql` einfach noch einmal
> aus – der Migrationsblock darin holt neue Vorlagen nach `bars` nach.

| Datei | Inhalt |
| --- | --- |
| `seeds/seed_hamburg_duesseldorf.sql` | Städte Hamburg und Düsseldorf samt Kneipen |
| `seeds/seed_kneipen_erweiterung.sql` | Zusätzliche Kneipen für bestehende Städte (damit 9 Stops zusammenkommen) |

## Drei Dinge, die man leicht übersieht

1. **Admin-Rolle.** Am Ende von `07_ugc_bars_spiele.sql` steht eine
   E-Mail-Adresse. Passt sie nicht zum eigenen Konto, fehlen später alle
   Moderationsrechte.
2. **Altbestand.** `meine_kneipen` und `meine_spielformen` werden von 07
   migriert, aber bewusst nicht gelöscht. Wenn die Migration im Alltag
   bestätigt ist: `drop table meine_kneipen, meine_spielformen;`
3. **Aufräum-Skripte laufen zuletzt.** `10` und `13` entfernen Spalten, in die
   ein älterer Client noch schreibt. Auf einer frischen Datenbank ist das egal –
   in einer laufenden Installation gilt: erst das passende Frontend deployen und
   bestätigen, dann aufräumen. Auf der Produktionsdatenbank ist `13` deshalb
   Stand 23.08.2026 noch nicht ausgeführt.

## Hintergrund

Warum die Tabellen so geschnitten sind, steht in
[`../docs/architektur-bars-und-spiele.md`](../docs/architektur-bars-und-spiele.md),
[`../docs/architektur-routen.md`](../docs/architektur-routen.md) und
[`../docs/architektur-beliebtheit.md`](../docs/architektur-beliebtheit.md).
Warum der Zeilenschutz so aussieht, wie er aussieht: `claude/teilnehmer-modell.md`
im Claude-Projekt.
