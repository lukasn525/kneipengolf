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

## Zwei Dinge, die man leicht übersieht

1. **Admin-Rolle.** Am Ende von `07_ugc_bars_spiele.sql` steht eine
   E-Mail-Adresse. Passt sie nicht zum eigenen Konto, fehlen später alle
   Moderationsrechte.
2. **Altbestand.** `meine_kneipen` und `meine_spielformen` werden von 07
   migriert, aber bewusst nicht gelöscht. Wenn die Migration im Alltag
   bestätigt ist: `drop table meine_kneipen, meine_spielformen;`

## Hintergrund

Warum die Tabellen so geschnitten sind, steht in
[`../docs/architektur-bars-und-spiele.md`](../docs/architektur-bars-und-spiele.md),
[`../docs/architektur-routen.md`](../docs/architektur-routen.md) und
[`../docs/architektur-beliebtheit.md`](../docs/architektur-beliebtheit.md).
