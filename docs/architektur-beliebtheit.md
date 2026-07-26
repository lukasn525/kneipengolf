# Architektur: Beliebtheit von Bars (v2.3)

_Stand: Juli 2026 · baut auf [`architektur-bars-und-spiele.md`](./architektur-bars-und-spiele.md)
und [`architektur-routen.md`](./architektur-routen.md) auf_

Mit user-generated Bars entsteht ein neues Problem: Die Liste wächst, aber
nichts darin sagt, **was sich lohnt**. Wer eine Route baut, sieht dreissig
Namen und weiß nichts über sie. Dieses Dokument beschreibt den
Beliebtheitsindex – und vor allem, warum er so schmal geschnitten ist.

---

## 1. Was der Index misst – und was nicht

Er misst **Zuspruch, nicht Qualität**. Die Frage lautet nicht „ist diese
Kneipe gut?", sondern „wie viele verschiedene Menschen haben sich für sie
entschieden?". Das ist bescheidener, aber ehrlich messbar.

Daraus folgen zwei Regeln, die alles Weitere bestimmen:

**Gezählt werden Personen, nicht Ereignisse.** Wer zehnmal dieselbe Tour
startet, erzeugt genau eine Stimme. Jedes der vier Signale steht in der
View als `count(distinct …)`. Das ist der wichtigste Schutz gegen
Selbstbeweihräucherung – wirksamer als jede nachgelagerte Missbrauchs-
erkennung, weil er strukturell ist.

**Nichts zählt ohne echten Abend.** Empfehlungen kann nur abgeben, wer an
einer Tour teilgenommen hat, in der die Bar auch wirklich auf der Route
stand. Das steht nicht im Frontend, sondern in der INSERT-Policy:

```sql
with check (
  user_id = auth.uid()
  and exists (select 1 from teilnehmer tn
              where tn.tour_id = bar_empfehlungen.tour_id
                and tn.user_id = auth.uid())
  and exists (select 1 from tour_kneipen tk
              where tk.tour_id = bar_empfehlungen.tour_id
                and tk.bar_id  = bar_empfehlungen.bar_id)
)
```

Eine Bar „von aussen" hochzuvoten ist damit technisch unmöglich, nicht
nur unerwünscht.

## 2. Vier Signale, eine Zahl

| Signal | Gewicht | Woher | Warum dieses Gewicht |
| --- | --- | --- | --- |
| **Empfehlung** | ×5 | `bar_empfehlungen` | Bewusster Akt nach einem echten Abend – das teuerste und ehrlichste Signal |
| **Gruppe** | ×3 | verschiedene Hosts gespielter Touren | Jemand hat die Bar wirklich bespielt, nicht nur angesehen |
| **Route** | ×2 | verschiedene Ersteller öffentlicher Routen | Jemand hält sie für vorzeigbar genug, sie zu veröffentlichen |
| **Übernahme** | ×1 | `bars.quelle_bar_id` | Jemand fand sie gut genug zum Behalten – aber nebenbei, im Paket |

```
punkte = 5·empfehlungen + 3·gruppen + 2·routen + 1·uebernahmen
```

Die drei impliziten Signale sind der Grund, warum der Index **ab Tag eins
funktioniert**. Hätte er nur Empfehlungen, stünde am Anfang überall null –
und niemand empfiehlt in eine leere Liste hinein.

### Warum eine View und keine Zählerspalten

`bar_beliebtheit` ist eine **View**, keine Spalten an `bars` und keine
Trigger. Vier Aggregate über kleine Tabellen sind billig, und die Zahlen
können per Konstruktion nicht veralten. Zähler in Spalten bräuchten
Trigger auf `tour_kneipen`, `touren`, `routen_stops`, `routen` und `bars` –
fünf Stellen, an denen die Wahrheit auseinanderlaufen kann.

Wird die View eng (grob ab fünfstelligen Bar-Zahlen), wird daraus eine
materialized view mit nächtlichem Refresh. Der Weg dahin steht am Ende von
`supabase/09_beliebtheit.sql`; am Frontend ändert sich dabei nichts.

### Sichtbarkeit: Summen ja, Namen nein

Die View läuft mit Eigentümerrechten und liefert **ausschliesslich
Aggregate**. Wer wen empfohlen hat, ist über `bar_empfehlungen` geschützt:
lesen darf man dort nur die eigene Stimme (und die Moderation). Die
Punktzahl allein verrät nichts – wer die Bar selbst nicht sehen darf,
kommt über `bars` und dessen RLS ohnehin nicht an sie heran.

## 3. Wie es sich anfühlt

### Stufen statt Punkte

„37 Punkte" sagt niemandem etwas. Angezeigt wird deshalb eine Stufe:

| Punkte | Marke | Entspricht etwa |
| --- | --- | --- |
| ab 25 | **Klassiker** | mehrere Empfehlungen, mehrere Gruppen, in Routen |
| ab 10 | **beliebt** | drei Gruppen und eine Route |
| ab 5 | **gefragt** | zwei Gruppen, oder eine Gruppe plus Empfehlung |
| darunter | nichts | einmal gespielt |

Zwei Schwellen sind bewusst gesetzt:

**Unter fünf Punkten gibt es kein Abzeichen.** Ein einzelnes Spiel einer
einzelnen Gruppe (3 Punkte) reicht nicht – sonst trüge nach dem ersten
Abend jede Bar eine Marke und die Auszeichnung wäre wertlos.

**Bei null steht ebenfalls nichts**, kein Chip „0 Punkte". Das wäre eine
Bestrafung fürs Neusein, und neue Bars sind genau das, was die App will.

Wer es genauer wissen will, liest die Zeile darunter: „3× empfohlen ·
5 Gruppen · in 2 Routen".

### Wo es hilft

- **Bar-Picker beim Erstellen:** Vorschläge und Community-Bars stehen nach
  Beliebtheit sortiert. Das ist der eigentliche Zweck der Übung – wer eine
  Route baut, sieht Bewährtes zuerst.
- **Bar-Bibliothek:** Marke, Klartextzeile und ein Sortierschalter
  („beliebteste zuerst" / „A–Z").
- **Eigene Bars werden nicht umsortiert.** „Meine Bars" bleibt in
  gewohnter Reihenfolge; die eigene Liste nach Beliebtheit zu sortieren
  wäre eine Bewertung des eigenen Geschmacks.

### Die Bewertung nach dem Spiel

Sie erscheint **erst nach dem Beenden der Tour**, direkt unter der
Endauswertung: „Welche Kneipen waren top?" mit den Stops als Chips. Ein
Tipp pro Kneipe, nochmal antippen nimmt zurück.

Drei Entscheidungen, die verhindern, dass daraus Arbeit wird:

- **Kein Zwischenschritt im Ablauf.** Am Ende eines Abends will niemand
  ein Formular ausfüllen. Wer nichts antippt, verliert nichts – die
  impliziten Signale laufen weiter.
- **Keine Sterne, keine Skala.** Eine fünfstufige Bewertung erzwingt eine
  Abwägung, die im Kneipenlicht niemand trifft. „War top" reicht.
- **Nur Stops mit `bar_id`.** Reine Snapshots ohne Bibliothekseintrag
  hätten kein Ziel für die Empfehlung.

---

## 4. Umsetzung

### 4.1 Datenbank

`supabase/09_beliebtheit.sql` ausführen (nach `08_routen_teilen.sql`).
Es legt an:

1. `bar_empfehlungen` (PK `bar_id, user_id`) samt RLS
2. View `bar_beliebtheit` mit den vier Signalen und `punkte`
3. `grant select` auf die View für `authenticated`

### 4.2 Frontend

| Datei | Änderung |
| --- | --- |
| `src/lib/beliebtheit.ts` (neu) | Laden, Stufen, Klartext, Sortierung, Empfehlung setzen |
| `src/components/Bibliothek.tsx` | Marke + Klartextzeile an der Bar, Sortierschalter |
| `src/app/create/page.tsx` | Picker nach Beliebtheit sortiert, Marke ab Stufe „beliebt" |
| `src/app/tour/[code]/page.tsx` | `KneipenBewertung` unter der Endauswertung |
| `src/components/Icons.tsx` | `IconFlamme` |

### 4.3 Rauchtest

1. Tour aus einer Route spielen und **beenden** → unter der Endauswertung
   erscheinen die Stops als Chips.
2. Zwei Kneipen antippen → „2 Empfehlungen gespeichert".
3. Menüpunkt **Bars** → die beiden tragen jetzt eine Marke, darunter steht
   „1× empfohlen · 1 Gruppe".
4. **Spiel erstellen** → Bar-Picker → unter „Vorschläge" stehen sie oben.
5. Zweites Konto: dieselbe Bar empfehlen → Zähler steigt auf 2.
   Dieselbe Person ein zweites Mal → bleibt 1.
6. Eine Bar, an deren Tour man nicht teilgenommen hat, direkt über die API
   empfehlen → wird von der Policy abgelehnt.

---

## 5. Bewusste Auslassungen

- **Keine Sterne-Bewertung.** Zuspruch lässt sich zählen, Qualität nicht –
  jedenfalls nicht mit den paar Datenpunkten, die ein Freundeskreis
  erzeugt. Ein 4,2-Sterne-Durchschnitt aus drei Stimmen wäre Theater.
- **Kein Zeitverfall.** Eine Bar, die vor einem Jahr beliebt war, gilt
  weiter als beliebt. Ein Halbwertszeitfaktor wäre schnell gebaut, aber
  bei diesen Datenmengen reines Rauschen. Wenn er kommt, dann als
  Gewichtung nach `erstellt_am` in der View – ohne Schemaänderung.
- **Keine Negativstimmen.** Wer eine Bar schlecht findet, blendet sie für
  sich aus (`bar_ausblendungen`) oder meldet sie (`bar_meldungen`). Ein
  öffentlicher Daumen nach unten lädt zum Ärgern ein und hilft niemandem.
- **Keine Rangliste der Bars.** Beliebtheit sortiert Vorschläge, sie ist
  kein eigener Bildschirm. Sonst optimieren Leute auf die Zahl statt auf
  den Abend.
