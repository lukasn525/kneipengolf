# Architektur: Bars, Spiele und der Gameplay-Loop (v2.1)

_Stand: Juli 2026 · Grundlage für alles Weitere_

Dieses Dokument beschreibt die Architektur hinter drei Anforderungen:
getrennte Übersichten für **Bars** und **Spiele** im Hauptmenü, eine
langfristige Speicher- und Rechtelösung für selbst angelegte Bars, und ein
unterbrechungsfreier Spielablauf.

> **Fortsetzungen:** Das hier beschriebene Sichtbarkeits-, Rechte- und
> Snapshot-Modell wird unverändert weiterverwendet in
> [`architektur-routen.md`](./architektur-routen.md) (v2.2, ganze Routen
> speichern und teilen) und
> [`architektur-beliebtheit.md`](./architektur-beliebtheit.md) (v2.3,
> Beliebtheitsindex einer Bar).

---

## 1. Architektur-Konzept: Speicherung & Rechte

### 1.1 Eine Tabelle statt vier

Vorher lagen Bars in drei Töpfen: `kneipen_vorlage` (kuratiert),
`meine_kneipen` (persönlich) und implizit in `tour_kneipen` (Route).
Jede neue Anforderung hätte einen vierten Topf gebraucht.

Jetzt ist **`bars` die einzige Quelle der Wahrheit**. Der Unterschied
zwischen kuratiert, privat und öffentlich ist kein Tabellenwechsel, sondern
ein Spaltenwert:

| Fall | `ersteller_user_id` | `sichtbarkeit` |
| --- | --- | --- |
| Kuratiert vom Team | `NULL` | `oeffentlich` |
| Selbst angelegt, privat | User-ID | `privat` |
| Selbst angelegt, veröffentlicht | User-ID | `oeffentlich` |

Das hat drei Konsequenzen, die sich langfristig auszahlen:

- **Veröffentlichen ist ein UPDATE, kein Kopiervorgang.** Keine Duplikate,
  keine Sync-Probleme zwischen „meiner" und „der globalen" Version.
- **Eine Query versorgt jede Ansicht.** Picker, Hauptmenü und Moderation
  lesen dieselbe Tabelle; nur die Gruppierung im Frontend unterscheidet sich.
- **Community-Bars sind adoptierbar.** Ein `update bars set ersteller_user_id
  = null` macht aus einer guten Community-Bar eine kuratierte – ohne Migration.

### 1.2 Route ≠ Bibliothek: der Snapshot

`tour_kneipen` speichert weiterhin **Name und Koordinaten als Kopie** und
zusätzlich neu `bar_id` als Referenz. Diese Doppelung ist Absicht:

- Der Snapshot macht **Löschen gefahrlos**. Wer eine Bar aus seiner Liste
  entfernt, zerstört keine laufende oder vergangene Tour – `bar_id` wird
  `NULL`, der Stop bleibt vollständig.
- Die Referenz erlaubt die **Session-Sichtbarkeit** (siehe 1.3) und später
  „Diese Bar in meine Liste übernehmen".

### 1.3 Privat vs. Öffentlich vs. Session

Die Anforderung „private Bars sind für Mitspieler der Session sichtbar" wird
nicht durch Aufweichen der Rechte gelöst, sondern durch eine präzise
Lesebedingung. `bars` ist lesbar, wenn **eine** dieser Bedingungen zutrifft:

1. `sichtbarkeit = 'oeffentlich'` und nicht gesperrt → globale Liste
2. `ersteller_user_id = auth.uid()` → meine eigenen, auch private
3. Ich bin Teilnehmer einer Tour, in deren Route diese Bar steht → Session
4. Ich bin Moderator:in oder Admin

Bedingung 3 als SQL (verkürzt):

```sql
exists (
  select 1 from tour_kneipen tk
  join teilnehmer tn on tn.tour_id = tk.tour_id
  where tk.bar_id = bars.id and tn.user_id = auth.uid()
)
```

Die Session-Sichtbarkeit endet damit **automatisch mit der Mitgliedschaft** –
es braucht kein Aufräumen, kein Ablaufdatum, keinen Cron-Job.

### 1.4 Die Routen-Ausnahme wird erzwungen, nicht nur eingehalten

„Bars aus einer Route dürfen nicht automatisch veröffentlicht werden" ist
keine Frontend-Konvention, sondern eine **INSERT-Bedingung**:

```sql
create policy "bars_neu" on bars
  for insert to authenticated
  with check (ersteller_user_id = auth.uid()
              and sichtbarkeit = 'privat'
              and gesperrt = false);
```

Ein Client kann eine Bar technisch nicht öffentlich anlegen – auch nicht bei
einem Bug oder direkt gegen die API. Öffentlich wird sie nur durch ein
bewusstes UPDATE aus dem Hauptmenü.

### 1.5 Rechte- und Rollensystem

Drei Rollen, absteigend nach Reichweite:

| Rolle | Woher | Darf |
| --- | --- | --- |
| **Admin** | Eintrag in `benutzer_rollen` | alles; Rollen vergeben (per SQL) |
| **Moderator:in** | Eintrag in `benutzer_rollen` | fremde Bars/Spiele bearbeiten, sperren, löschen; Meldungen lesen |
| **Ersteller:in** | implizit über `ersteller_user_id` | eigene Inhalte bearbeiten, löschen, veröffentlichen und zurückziehen |
| **Spieler:in** | jede:r Angemeldete | anlegen (privat), für sich ausblenden, melden |

Vier Details, die das System robust machen:

- **`gesperrt` ist die Moderations-Bremse.** Gesperrte Bars sind für alle
  unsichtbar. Die UPDATE-Policy für Ersteller verlangt `gesperrt = false` –
  eine gesperrte Bar kann sich also **nicht selbst entsperren**.
- **Kein Eigentümerwechsel.** Die `with check`-Bedingung bindet
  `ersteller_user_id` an `auth.uid()`; eine Bar lässt sich nicht auf eine
  andere Person umschreiben.
- **Rollen kommen aus `security definer`-Funktionen** (`ist_admin()`,
  `ist_moderator()`). Das verhindert Policy-Rekursion und macht die Rollen-
  tabelle für Clients unschreibbar – Rollen vergibt nur der SQL-Editor.
- **Ausblenden ist kein Löschen.** `bar_ausblendungen` ist eine rein
  persönliche Zuordnung. Wer eine Community-Bar nicht mag, entfernt sie aus
  seiner Sicht, ohne sie anderen wegzunehmen.

### 1.6 Moderation ohne Dauerlast

`bar_meldungen` sammelt Meldungen (ein Eintrag pro Nutzer und Bar, per
`unique` gegen Spam). Am Ende der SQL-Datei stehen drei fertige Abfragen:
gemeldete Bars nach Häufigkeit, Bar sperren, Community-Bar adoptieren. Damit
ist Moderation ein Fünf-Minuten-Job im SQL-Editor, solange die Nutzerzahl
klein ist – und eine Admin-UI kann später denselben Datenpfad nutzen.

---

## 2. Logik-Flow: der neue Gameplay-Loop

Grundidee: **Das Spiel weiß immer, wer als Nächstes dran ist.** Niemand muss
zwischen zwei Schlücken ein Menü suchen.

Neu in der Datenbank: `teilnehmer.geraet_id`. Jedes Gerät bekommt eine
stabile ID (`localStorage`) und schreibt sie an die Teilnehmer, die es
verwaltet. Damit kennt jedes Gerät seine eigene Pass-and-Play-Runde – und
weiß, wofür die anderen zuständig sind.

```
Stop öffnen (Pin, Scorecard oder „Nächster Stop")
   └─ erster Spieler dieses Geräts, der hier noch nichts eingetragen hat,
      wird automatisch aktiv   →   Kopfzeile „Jetzt dran: Marie · 1/3"

Schlücke zählen  →  „Eintragen & weitergeben"
   ├─ es gibt noch Spieler auf diesem Gerät
   │     → nächster Spieler wird aktiv, Fenster bleibt offen
   │       Hinweis „Gewertet – weiter mit Jonas" (2 s)
   │
   └─ Gerät ist durch
         ├─ andere Geräte fehlen noch
         │     → Wartezustand im Fenster, Realtime bleibt aktiv
         │
         └─ alle Teilnehmer der Session haben gewertet
               → Fenster schließt sich automatisch
               → Übergangskarte „Alle durch" mit einem Button:
                    • „Nächstes Game →"  (nächster offener Stop)
                    • oder „Zur Rangliste →" (letzter Stop)
```

Drei Entscheidungen, die den Ablauf wirklich flüssig machen:

- **Der Auto-Close hängt an allen Teilnehmern, nicht am Gerät.** Trägt das
  letzte Gerät ein, schließt das Fenster über Realtime bei *allen* – die
  Gruppe erlebt denselben Moment gleichzeitig.
- **Fertige Stops schließen sich nicht.** Beim Öffnen wird gemerkt, ob der
  Stop schon komplett war (`panelKomplettBeimOeffnen`). Nur ein Stop, der
  *während* des Betrachtens fertig wird, löst den Übergang aus. Nachschauen
  und Korrigieren bleibt jederzeit möglich.
- **Der Wechsel folgt der Routenreihenfolge**, nicht der Beitrittsreihenfolge
  – der nächste offene Stop ist immer der, den die Gruppe als nächstes
  ansteuert.

---

## 3. Umsetzungsschritte

### 3.1 Datenbank (einmalig in Supabase)

`supabase/07_ugc_bars_spiele.sql` im SQL-Editor ausführen. Das Skript ist
idempotent und additiv – bestehende Tabellen bleiben als Backup liegen.

Es legt an bzw. ändert:

1. `benutzer_rollen` + `ist_admin()` / `ist_moderator()`
2. `bars` (+ Indizes, `geaendert_am`-Trigger)
3. `bar_ausblendungen`, `bar_meldungen`
4. `spielformen`: neue Spalten `ersteller_user_id`, `sichtbarkeit`, `gesperrt`
5. `spielform_ausblendungen`
6. `tour_kneipen.bar_id`, `teilnehmer.geraet_id`
7. Migration: `kneipen_vorlage` und `meine_kneipen` → `bars`,
   `meine_spielformen` → `spielformen`
8. RLS-Policies für alle neuen Tabellen
9. Realtime für `bars` und `tour_kneipen`
10. Admin-Rolle für die eigene E-Mail

> **Prüfen:** Die E-Mail in Abschnitt 8 muss zu deinem Konto passen, sonst
> fehlen dir die Moderationsrechte.

### 3.2 Frontend

| Datei | Änderung |
| --- | --- |
| `src/lib/types.ts` | Typen `Bar`, `Sichtbarkeit`, `BenutzerRolle`; `Spielform` erweitert; `bar_id`/`geraet_id` |
| `src/lib/ugc.ts` (neu) | einzige Zugriffsschicht: laden, anlegen, löschen, veröffentlichen, ausblenden, melden, Rollen, `geraetId()` |
| `src/components/Bibliothek.tsx` (neu) | `BarsAnsicht` + `SpieleAnsicht` mit Verwaltung, Rechte-abhängigen Aktionen und Moderations-Knopf |
| `src/components/Icons.tsx` | Icons für Auge/Auge-aus, Globus, Schloss, Plus, Weiter, Warnung |
| `src/app/dashboard/page.tsx` | Hauptmenü mit Tabs: **Spielen / Bars / Spiele** (ab v2.2 zusätzlich **Routen**); „Deine Spiele" heißt jetzt „Deine Touren" |
| `src/app/create/page.tsx` | Picker liest aus `bars` (Meine / Vorschläge / Community); neue Bars werden immer privat gespeichert; `bar_id` wandert in die Route |
| `src/app/tour/[code]/page.tsx` | `oeffneStop`, `wertungAbschliessen`, Auto-Close-Effekt, `NaechstesGame`-Karte, Spielerkopf im Challenge-Panel, `geraet_id` beim Beitreten |

### 3.3 Reihenfolge beim Deployen

1. SQL ausführen (die App verträgt beides, aber Bars erscheinen erst danach).
2. `git checkout main && git merge dev-1.1 && git push origin main`.
3. Rauchtest: siehe unten.

### 3.4 Rauchtest auf der Live-URL

1. **Hauptmenü** zeigt drei Tabs. Unter *Bars* eine Bar über die Adresssuche
   anlegen → erscheint unter „Meine Bars" mit Chip **privat**.
2. Globus-Icon antippen → Bestätigung → Chip wechselt auf **öffentlich**.
3. Eine fremde Bar über das Auge ausblenden → verschwindet aus dem Picker
   beim Tour-Erstellen.
4. **Tour erstellen** → im Picker erscheinen „Meine Bars", „Vorschläge",
   „Von der Community" getrennt. Eine Bar per Kartentipp anlegen → landet
   privat in der Bibliothek (nicht öffentlich!).
5. **Loop testen** mit zwei Teilnehmern auf einem Gerät: Stop öffnen →
   Kopfzeile „Jetzt dran: A · 1/2" → eintragen → wechselt automatisch auf B
   → eintragen → Fenster schließt sich → „Nächstes Game" führt zum nächsten
   Stop.
6. Beim letzten Stop erscheint stattdessen „Zur Rangliste".

---

## 4. Bewusste Auslassungen

- **Keine Freigabe-Warteschlange fürs Veröffentlichen.** Bei einem
  Freundeskreis wäre Vorab-Moderation Reibung ohne Nutzen; `gesperrt` +
  Meldungen reichen. Wächst die Nutzerzahl, wird aus `sichtbarkeit` ein
  dritter Zustand `eingereicht` – die Policies sind darauf vorbereitet.
- **Kein Bearbeiten fremder Bars durch Ersteller-Vorschläge.** Wer eine
  falsche Position sieht, meldet sie. Kollaboratives Editieren bräuchte
  Versionierung – das ist eine eigene Ausbaustufe.
- **`meine_kneipen` und `meine_spielformen` werden nicht gelöscht.** Sie
  bleiben als Sicherheitsnetz, bis die Migration im Alltag bestätigt ist.
  Danach: `drop table meine_kneipen, meine_spielformen;`
