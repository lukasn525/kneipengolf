# 🍺 Kneipen-Golf

Spiel dich mit Freunden durch die Kneipen. An jeder Station leerst du dein Getränk
mit **so wenig Schlücken wie möglich** – aber jedes Mal in einer anderen, zufällig
gezogenen Spielform. Gewertet wird wie beim **Golf**: wenig ist gut, zu viel gibt
Strafpunkte. Am Ende: Sieger + Rangliste.

> Spielbar auch komplett **alkoholfrei** – „Getränk" ist neutral gemeint.
> Bitte verantwortungsvoll trinken und eure Grenzen kennen.

## Spielablauf

1. **Konto erstellen** (E-Mail + Passwort).
2. **Spiel erstellen** → **Stadt wählen** (Bonn oder Köln, kuratierte Kneipen).
3. **Route bearbeiten**: Reihenfolge ändern, Stops entfernen, eigene Kneipe ergänzen.
4. **Golf-Regeln** einstellen (Par-Schwelle, Strafpunkte) → Tour-Code wird erzeugt.
5. **Mitspieler einladen** (Link/Code) **oder** mehrere Personen auf einem Gerät (Pass-and-Play).
6. **Tour starten** und die Kneipen ablaufen – an jedem Pin Challenge ziehen, Schlücke
   zählen, erledigt markieren. **Rangliste aktualisiert sich live.**

## Tech-Stack

| | Wahl |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Karte | Leaflet + OpenStreetMap (kein API-Key) |
| Backend | Supabase (Auth, PostgreSQL, Realtime) |
| Hosting | Vercel |

---

## 1. Lokal starten

```bash
npm install
cp .env.example .env.local   # und Werte eintragen (siehe Schritt 2)
npm run dev                  # http://localhost:3000
```

Ohne Supabase-Keys läuft die App in einen Hinweis-Bildschirm – Auth/Touren brauchen Supabase.

## 2. Supabase einrichten (einmalig)

1. Auf **[supabase.com](https://supabase.com)** kostenlos anmelden → **New project**
   (Name z. B. `kneipen-golf`, Datenbank-Passwort merken, Region Europe).
2. Warten, bis das Projekt bereit ist. Dann links **SQL Editor** → **New query** →
   den **kompletten Inhalt von `supabase/schema.sql`** einfügen → **Run**.
   Das legt alle Tabellen, Sicherheits-Policies, Realtime und die kuratierten
   Kneipen für Bonn & Köln an.
3. Links **Project Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   Beide in `.env.local` eintragen (siehe `.env.example`). Der anon-Key ist
   öffentlich und darf ins Frontend.
4. **Authentication → Sign In / Providers → Email**: aktiviert lassen.
   Für einen schnellen Test **„Confirm email" ausschalten** (Authentication →
   Providers → Email → *Confirm email* off), dann kann man sich sofort einloggen.

## 3. Auf Vercel deployen

1. Repo zu GitHub pushen.
2. Auf **[vercel.com](https://vercel.com)** → **Add New → Project** → das GitHub-Repo
   importieren. Framework wird als **Next.js** erkannt – Defaults passen.
3. Vor dem Deploy unter **Environment Variables** eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy** klicken. Nach dem Build gibt es eine `*.vercel.app`-URL.
5. Zurück in Supabase: **Authentication → URL Configuration** die Vercel-URL als
   **Site URL** eintragen (für korrekte Auth-Redirects).

> Änderst du später Env-Vars in Vercel, einmal **Redeploy** auslösen.

## Projektstruktur

```
src/
├── app/
│   ├── layout.tsx            Root-Layout + Session-Provider
│   ├── page.tsx              Start / Login-Einstieg
│   ├── auth/page.tsx         Registrieren & Anmelden
│   ├── dashboard/page.tsx    Spiel erstellen / per Code beitreten
│   ├── create/page.tsx       Stadt → Route ordnen/ergänzen → Golf-Regeln
│   └── tour/[code]/page.tsx  Lobby · Karte+Challenge · Live-Rangliste · Auswertung
├── components/               UI, Karte, Session/Guard, TopBar
└── lib/                      Supabase-Client, Typen, Golf-Wertung
supabase/schema.sql           Komplettes DB-Schema + Seed (Bonn, Köln)
legacy/                       Alter Vanilla-JS-Prototyp (Referenz)
```

## Eigene Kneipen / Städte pflegen

- **Kneipen einer Stadt:** Supabase → Table Editor → `kneipen_vorlage`. Koordinaten
  findest du per Rechtsklick auf [openstreetmap.org](https://www.openstreetmap.org)
  → „Adresse anzeigen" zeigt lat/lng.
- **Neue Stadt:** Zeile in `staedte` ergänzen (slug eindeutig), dann zugehörige
  `kneipen_vorlage`-Einträge.
- **Spielformen:** Tabelle `spielformen` erweitern.

## Wertung (Golf)

Pro Kneipe & Teilnehmer: `roh = schlücke + strafschlücke`.
Strafpunkte (wenn aktiv): `max(0, roh − par) × strafe_pro_schluck`.
**Gesamt** = Summe(roh) + Summe(Strafpunkte). **Niedrigster gewinnt.**

## Status & nächste Schritte

Erster lauffähiger Stand (kompletter Flow, live über Supabase). Sinnvolle nächste
Iterationen: Kneipen per Karten-Klick statt Formular hinzufügen, Adress-Suche
(OpenStreetMap Nominatim), feinere RLS-Policies (Mitgliedschaft pro Tour),
PWA/Installierbarkeit, weitere Städte.
