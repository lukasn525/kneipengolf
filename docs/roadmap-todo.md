# Kneipen-Golf – Roadmap & To-do (nächste Versionen)

_Leitprinzip: **einfach & schnell spielbar bleibt oberste Priorität.** Neue Features nur,
wenn sie den Kern nicht verkomplizieren. Erweiterte Optionen immer „einen Tipp entfernt",
nie im Hauptweg._

Legende: ✅ erledigt (wartet auf Deploy) · 🔜 als Nächstes · 💡 geplant · ⏳ später/optional · ❓ Design-Entscheidung offen

---

## v1.1 – Korrekturen (bereit, wartet auf Deploy)

- ✅ **Route-Bug behoben:** Route wird bei Hinzufügen/Löschen/Umsortieren zuverlässig neu
  berechnet; nur die neueste Antwort greift; nie eine veraltete Linie.
- ✅ **Selbst gesetzte Bar wird auswählbar:** eigene Kneipe landet im „Aus Liste"-Pool und
  ist nach Entfernen aus der Route wieder auswählbar.

---

## v1.2 – Erstellen vereinfachen (der größte Handling-Gewinn)

Ziel: sichtbarer Hauptweg **Stadt → Route → Erstellen**. Alles Feinere zugeklappt.

- 🔜 **„Erweiterte Einstellungen" bündeln:** Par-Schwelle, Strafpunkte und Pin-Symbol aus
  dem Hauptweg in einen zugeklappten Bereich verschieben (mit sinnvollen Defaults).
- ❓ **Darstellung noch offen – zur Entscheidung:**
  - Option 1: Aufklapp-Bereich („Akkordeon") unten auf der Erstellen-Seite.
  - Option 2: Eigener kleiner Schritt „Regeln" (nur wer will, tippt sich durch).
  - Option 3: Zahnrad-Icon oben rechts öffnet die Feineinstellungen als Fenster.
- 💡 Liste ↔ Karte verbinden: Tippen auf einen Listeneintrag zentriert/hebt den Stop auf der
  Karte hervor.

---

## v1.3 – Spielformen anpassbar (in den erweiterten Einstellungen)

- 🔜 **An-/Abwählen:** Liste aller Spielformen mit Häkchen; nur aktive kommen ins Spiel.
- 🔜 **Eigene Spielform hinzufügen:** Titel + kurze Beschreibung → landet als aktive,
  abwählbare Karte in derselben Liste.
- 🔜 **Absicherung:** mindestens eine Spielform muss aktiv bleiben (sanfter Hinweis statt
  leerem Zustand).

---

## v1.4 – Spiel-Loop führen (schnell & ohne Suchen spielen)

- 💡 **„Nächster Stop"-Wegweiser:** nächster offener Stop hervorgehoben; prominenter Button
  „Aktuelle Kneipe" öffnet direkt deren Challenge (kein Pin-Suchen).
- 💡 **Spielerwahl als Chips** statt Dropdown: aktiver Spieler sichtbar, ein Tipp zum Wechseln
  (wichtig für Pass-and-Play).
- 💡 **Fortschritt sichtbar:** Balken „3/9 Stops" + kleine Rückmeldung beim Abschließen.
- 💡 **Stops-/Scorecard-Ansicht** als Alternative zur Karte (Liste zum Zählen).
- 💡 Schluck-Zähler: größere Tap-Flächen, Live-Anzeige „über/unter Par", Rückfrage bei
  „nicht machbar (+Strafe)".

---

## v1.5 – Lobby & Einladen (mehr Leute machen mit)

- 💡 **QR-Code des Einladungslinks:** Freunde scannen und sind direkt drin.
- 💡 **Native Teilen-Funktion** (WhatsApp etc.) zusätzlich zu „Link kopieren".
- 💡 **Einladungs-Flow klarer:** wer über einen Link kommt, wird nach dem Zugangscode direkt
  in den Beitritt geführt („Du wurdest eingeladen").
- 💡 Beitreten (ich/mein Team) vs. „weitere Person/Team auf diesem Gerät" deutlicher trennen.

---

## v1.6 – Auswertung & Wiederkehr

- 💡 **Sieger-Moment:** 👑 hervorheben, Endauswertung feierlicher gestalten.
- 💡 **Teilbare Ergebnis-Karte** (Screenshot für die Gruppe).
- 💡 **Rematch:** „Nochmal mit gleicher Gruppe / gleicher Route".
- 💡 Optional: automatischer Vorschlag „Tour beenden", wenn alle alle Stops erledigt haben.

---

## v1.7 – Politur (Look & Feel)

- 💡 **Einheitliches Icon-Set** statt Emojis (⚙ 🗑 🧭 ▲ ▼ ✕) für ein ruhigeres, wertigeres Bild.
- 💡 **Micro-Animationen:** Fenster öffnen, Tab-Wechsel, Stop hinzufügen, Challenge abschließen.
- 💡 **Kartenstil-Default** fürs Spiel überdenken (heller/kontrastreicher zum Navigieren),
  UI bleibt dunkel.
- 💡 **Skeleton-Ladezustände** statt „lädt…"; klare Erst-Nutzer-Führung im Dashboard.
- 💡 Bestätigung auch bei „Tour beenden"; durchgehend große Tap-Ziele & Kontraste.

---

## v2.0 – Konto-Features (später / optional)

- ⏳ **„Meine Kneipen":** selbst angelegte Bars dauerhaft am Konto speichern, in jeder neuen
  Tour sofort auswählbar.
- ⏳ **Eigene Spielformen dauerhaft** am Konto (nicht pro Tour neu tippen).
- ⏳ **Statistiken:** Handicap-Verlauf, gespielte Touren, persönliche Bestwerte.

---

## Offline-/Robustheit (querschnittlich, laufend)

- ⏳ Kneipen haben oft schlechtes Netz: optimistische Anzeige (teilweise vorhanden),
  Karte/Route cachen, sanfte Fehlerbehandlung.

---

### Was ich als Reihenfolge empfehle

1. **v1.1 deployen** (Bug-Fix + Selbst-Bars).
2. **v1.2** Erstellen entschlacken – zuerst gemeinsam die Darstellung der erweiterten
   Einstellungen entscheiden (❓ oben).
3. **v1.3** Spielformen anpassbar.
4. Danach v1.4 (Spiel-Loop) als spürbarster Komfortgewinn, dann v1.5–v1.7.
5. Konto-Features (v2.0) erst, wenn der Kern rund ist.
