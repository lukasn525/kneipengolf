# Kneipen-Golf – Konzept

> **Update v3 (Umbau auf Next.js):** Die App wurde von einem Vanilla-JS-Prototyp auf
> **Next.js 14 + Supabase** umgestellt. Geänderte Grundsatzentscheidungen gegenüber v2:
> - **Echte Konten:** Jede:r meldet sich mit **E-Mail + Passwort** an (Supabase Auth),
>   statt nur Name + Tour-Code. Mitspieler können zusätzlich per Pass-and-Play auf einem
>   Gerät verwaltet werden.
> - **Stadt-Auswahl:** **Feste Städteliste mit kuratierten Kneipen** (Start: Bonn, Köln).
>   Pro Tour wird die Route in `tour_kneipen` kopiert, dort sortier-/ergänzbar.
> - **Tech:** Next.js (App Router) + TypeScript + Tailwind, Hosting auf **Vercel**.
> - **Datenmodell v3:** siehe `supabase/schema.sql` (maßgeblich). Tabellen: `staedte`,
>   `kneipen_vorlage`, `spielformen`, `touren`, `tour_kneipen`, `teilnehmer`,
>   `kneipen_challenge`, `ergebnisse`.
>
> Der Abschnitt unten (v2) bleibt als Historie erhalten.

---

# Kneipen-Challenge – Geschärftes Konzept (v2)

> Stand nach Konzept-Runden. Alle Grundsatzentscheidungen sind getroffen; das
> Datenmodell unten ist die verbindliche Grundlage für den nächsten Bau-Schritt.

## 1. Die Idee

Eine Gruppe spielt sich durch mehrere Kneipen. An jeder Kneipe leert man sein Getränk
mit **so wenig Schlücken wie möglich**, aber jedes Mal in einer anderen, zufällig
gezogenen Spielform. Gewertet wird wie beim **Golf**: wenig ist gut, zu viel gibt
Minuspunkte. Am Ende: Sieger + Rangliste.

## 2. Getroffene Entscheidungen (verbindlich)

| Thema | Entscheidung |
|-------|-------------|
| **Geräte / Modus** | Beides: jede:r tritt per Tour-Code auf eigenem Handy bei **oder** ein Handy verwaltet mehrere Teams. Gleiches Datenmodell. |
| **Beitritt** | Tour-Code öffnen → **Namen eingeben** → dabei. Jede:r Teilnehmer:in ist eine Wertungseinheit. |
| **Kneipe betreten** | Einfach den **Pin antippen** – kein GPS. |
| **Challenge je Kneipe** | Wird **einmal pro Kneipe** gezogen; **alle** an dieser Kneipe spielen **dieselbe** (fair vergleichbar). Zufall darf sich über Kneipen wiederholen. |
| **Wertung (Golf)** | Pro Tour eine einstellbare **Par-Schwelle**. Schlücke darüber = Minuspunkte. Funktion **abschaltbar**. Niedrigster Gesamtwert gewinnt. |
| **Challenge verweigert / nicht machbar** | Kostet **Strafschlücke** (fester Aufschlag, einstellbar) statt Reroll. |
| **Tour-Ende** | **Auswertung mit Sieger + Rangliste.** |
| **Kneipen** | **Feste Startliste + in der App ergänzbar** (Karte antippen oder Adresse). |
| **Live-Updates** | **Echtzeit für alle** → Supabase Realtime. Punkte/Rangliste aktualisieren sich live. |
| **Getränke** | Neutral als „**Getränk**" – auch alkoholfrei spielbar. Spielformen alkoholneutral formuliert. |
| **Look** | Tavernen-Nacht + Bierdeckel bleibt vorerst, Feinschliff später. |

### Konsequenz für die Technik
„Echtzeit für alle" bedeutet: **Supabase ist gesetzt** (nicht mehr optional). Der reine
localStorage-Modus bleibt nur als Offline-Notlauf für eine einzelne Person erhalten.

## 3. Datenmodell (v2)

Gegenüber v1 neu: **Teilnehmer-Ebene**, **gezogene Challenge pro Kneipe** (geteilt),
**Tour-Einstellungen** für die Golf-Wertung, **tour-eigene Zusatz-Kneipen**.

```
touren                       teilnehmer                kneipen
──────                       ──────────                ───────
id                           id                        id
code         (z.B. BONN-7F3K)tour_id  → touren         name
name                         name                      lat / lng
par_schwelle (Default 3)     beigetreten_am            adresse
strafe_aktiv (bool)                                    sortierung
strafe_pro_schluck (Default 1)                         tour_id  → touren (NULL = globale Startliste,
verweigerung_strafe (Default 5)                                   gesetzt = von dieser Tour ergänzt)
erstellt_am

kneipen_challenge            ergebnisse
─────────────────            ──────────
tour_id    → touren          id
kneipe_id  → kneipen         tour_id      → touren
spielform_id → spielformen   kneipe_id    → kneipen
gezogen_am                   teilnehmer_id→ teilnehmer
UNIQUE(tour_id, kneipe_id)   schlucke
                             strafschlucke   (für verweigerte Challenge)
spielformen                  erledigt
───────────                  erledigt_am
id                           UNIQUE(tour_id, kneipe_id, teilnehmer_id)
titel
beschreibung
schwierigkeit
```

**Lesart:**
- `kneipen_challenge` hält die **einmal pro Kneipe** gezogene Spielform – deshalb sehen
  alle Teilnehmer dort dieselbe Challenge.
- `ergebnisse` hält die **persönlichen Schlücke** jedes Teilnehmers pro Kneipe. Das ist
  die Tabelle, auf die Realtime lauscht → Rangliste live.
- Zusatz-Kneipen bekommen die `tour_id` der Tour, die sie angelegt hat; die Startliste
  hat `tour_id = NULL` und ist für alle sichtbar.

### Wertungsformel (Golf)
Pro Kneipe & Teilnehmer:  `roh = schlucke + strafschlucke`
Strafpunkte (nur wenn `strafe_aktiv`):  `max(0, roh − par_schwelle) × strafe_pro_schluck`
**Gesamtscore** = Summe(`roh`) + Summe(Strafpunkte). **Niedrigster gewinnt.**

## 4. Bildschirme (Screen-Flow)

1. **Start / Beitritt** – Tour-Code eingeben oder neue Tour erstellen, dann Name eingeben.
   (Beim Erstellen: Par-Schwelle / Strafen / Startregion festlegen.)
2. **Karte** – alle Kneipen als Pins, eigene Position optional. Button „Kneipe hinzufügen".
3. **Challenge-Panel** (Bierdeckel) – beim Antippen: gezogene Spielform, Schluck-Zähler,
   „erledigt" und „Challenge nicht machbar" (→ Strafschlücke).
4. **Rangliste** – live, Sieger hervorgehoben; am Tour-Ende die Endauswertung.

## 5. Aktualisierter Bau-Plan

| Schritt | Inhalt | Status |
|---------|--------|--------|
| 0 | Konzept & Struktur | ✅ |
| 1 | Prototyp: Karte + Marker + Challenge + Zähler (lokal) | ✅ vorhanden |
| 2 | **Datenmodell v2 in Supabase** (Schema unten) | ⬜ als Nächstes |
| 3 | **Beitritts-Flow** (Tour-Code + Name) | ⬜ |
| 4 | **Geteilte Challenge pro Kneipe** + Golf-Wertung | ⬜ |
| 5 | **Realtime-Rangliste** (Supabase Realtime) | ⬜ |
| 6 | **„Kneipe hinzufügen"** (Karte antippen / Adresse) | ⬜ |
| 7 | **Endauswertung** mit Sieger + Rangliste | ⬜ |
| 8 | Echte Kneipen eintragen, Look-Feinschliff, Deploy | ⬜ |

## 6. Verbleibende Detail-Entscheidungen (mit meinen Defaults)

Diese sind unkritisch – ich nehme sinnvolle Vorgaben an, jederzeit änderbar:

- **Par-Schwelle Standard:** 3 Schlücke. **Strafe pro Schluck über Par:** 1 Punkt.
  **Verweigerung:** +5 Strafschlücke.
- **Adresse → Koordinaten:** Beim In-App-Hinzufügen primär **Karte antippen** (kein
  Dienst nötig). Adress-Suche optional später über OpenStreetMap-Nominatim (gratis).
- **Startbildschirm** mit Kurz-Spielregeln vor der Namenseingabe.
- **Region der Startliste:** weiterhin Bonn als Platzhalter (leicht ersetzbar).
- **Keine Obergrenze** für Teilnehmer/Teams pro Tour.

> Verantwortungsvoll: Da „Getränk" neutral ist, läuft das Spiel auch komplett
> alkoholfrei. Ein kurzer Hinweis auf maßvolles Trinken passt gut auf den Startbildschirm.
