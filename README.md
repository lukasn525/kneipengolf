# 🍺 Kneipen-Golf

Spiel dich mit Freunden durch die Kneipen. An jeder Station leerst du dein Getränk
mit **so wenig Schlücken wie möglich** – jedes Mal in einer anderen, zufällig
gezogenen Spielform. Gewertet wird wie beim **Golf**: wenig ist gut, zu viel gibt
Strafpunkte. Am Ende: Sieger und Rangliste.

> Spielbar auch komplett **alkoholfrei** – „Getränk" ist neutral gemeint.
> Bitte verantwortungsvoll trinken und eure Grenzen kennen.

## Spielablauf

1. **Konto erstellen** (E-Mail + Passwort).
2. **Spiel erstellen** → Stadt wählen oder eine gespeicherte **Route** laden.
3. **Route anpassen**: Reihenfolge ändern, Stops entfernen, eigene Bar ergänzen.
4. **Golf-Regeln** einstellen (Par, Strafpunkte, Spielformen) → Tour-Code entsteht.
5. **Mitspieler einladen** (Link, QR oder Code) – oder mehrere Personen auf einem
   Gerät (Pass-and-Play).
6. **Loslaufen.** An jedem Stop Challenge ziehen, Schlücke zählen, eintragen. Das
   Spiel weiß, wer als Nächstes dran ist; die Rangliste läuft live mit.
7. **Auswerten** und kurz markieren, welche Kneipen top waren.

## Was die App sonst kann

| Bereich | Kurz |
| --- | --- |
| **Bars** | Eigene Bars dauerhaft am Konto, privat oder veröffentlicht; Filter nach Stadt; Stadt wird beim Anlegen automatisch erkannt |
| **Spiele** | Eigene Spielformen am Konto statt pro Tour neu getippt |
| **Routen** | Ganze Routen speichern, veröffentlichen und **per Link teilen**; geteilte Routen lassen sich übernehmen |
| **Beliebtheit** | Bars sammeln Zuspruch aus Empfehlungen, Spielen und Routen – der Picker schlägt Bewährtes zuerst vor |
| **Moderation** | Melden, global sperren, Community-Bars ins kuratierte Set übernehmen |

## Tech-Stack

| | Wahl |
| --- | --- |
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Karte | Leaflet + OpenStreetMap (kein API-Key) |
| Geocoding | Photon (über eigene Route `/api/geocode`) |
| Backend | Supabase (Auth, PostgreSQL, Realtime, RLS) |
| Hosting | Vercel |

---

## 1. Lokal starten

```bash
npm install
cp .env.example .env.local   # Werte aus Schritt 2 eintragen
npm run dev                  # http://localhost:3000
```

Ohne Supabase-Keys zeigt die App einen Hinweis-Bildschirm – Konten und Touren
brauchen Supabase.

## 2. Supabase einrichten

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen (Region Europe).
2. **SQL Editor** öffnen und die Skripte aus `supabase/` **in der nummerierten
   Reihenfolge** ausführen. Was welches Skript tut und worauf zu achten ist,
   steht in **[`supabase/README.md`](./supabase/README.md)**.
3. **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Beide in `.env.local` eintragen. Der anon-Key ist öffentlich und darf ins
   Frontend – geschützt wird über RLS, nicht über den Key.
4. **Authentication → Providers → Email** aktiv lassen. Für schnelle Tests
   *Confirm email* ausschalten.

## 3. Auf Vercel deployen

1. Repo zu GitHub pushen.
2. Auf [vercel.com](https://vercel.com) importieren – Next.js wird erkannt.
3. Unter **Environment Variables** eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - optional `SITE_ACCESS_CODE` (Zugangssperre, Standard siehe `src/middleware.ts`)
4. Deployen. Danach in Supabase unter **Authentication → URL Configuration** die
   Vercel-URL als **Site URL** eintragen.

> Env-Vars später geändert? Einmal **Redeploy** auslösen.

## Projektstruktur

```
src/
├── app/
│   ├── layout.tsx             Root-Layout + Session-Provider
│   ├── page.tsx               Start / Login-Einstieg
│   ├── auth/page.tsx          Registrieren & Anmelden (mit ?weiter=)
│   ├── zugang/page.tsx        Zugangscode vor der ganzen Seite
│   ├── dashboard/page.tsx     Hauptmenü: Spielen · Routen · Bars · Spiele
│   ├── create/page.tsx        Spiel erstellen · Routen-Modus (?modus=route)
│   ├── route/[token]/page.tsx Geteilte Route ansehen und übernehmen
│   ├── tour/[code]/page.tsx   Lobby · Karte + Challenge · Rangliste · Auswertung
│   └── api/                   geocode · route (Wegberechnung) · zugang
├── components/                UI, Karte, Bibliothek, Routen, Guard, TopBar
└── lib/                       Supabase-Client, Typen, Golf-Wertung, ugc,
                               routen, beliebtheit, orte, einstellungen
supabase/                      Nummerierte Migrationen + seeds/ (siehe README dort)
docs/                          Konzept, Architektur, Roadmap (siehe README dort)
```

## Inhalte pflegen

- **Bars und Städte:** Bars entstehen normalerweise in der App (Menüpunkt *Bars*).
  Kuratierte Bars sind schlicht Zeilen in `bars` mit `ersteller_user_id = null`.
  Eine gute Community-Bar wird per `update bars set ersteller_user_id = null`
  ins kuratierte Set übernommen.
- **Neue Stadt:** Zeile in `staedte` ergänzen. Die automatische Stadt-Erkennung
  beim Anlegen einer Bar greift danach sofort.
- **Spielformen:** Tabelle `spielformen` – oder direkt in der App unter *Spiele*.

## Wertung (Golf)

Pro Kneipe und Teilnehmer: `roh = schlücke + strafschlücke`.
Strafpunkte (wenn aktiv): `max(0, roh − par) × strafe_pro_schluck`.
**Gesamt** = Summe(roh) + Summe(Strafpunkte). **Niedrigster gewinnt.**

## Weiterlesen

- **[docs/README.md](./docs/README.md)** – Einstieg in Konzept und Architektur
- **[supabase/README.md](./supabase/README.md)** – Datenbank, Reihenfolge, Fallstricke
- **[docs/roadmap.md](./docs/roadmap.md)** – was als Nächstes ansteht
