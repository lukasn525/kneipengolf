# Deploy v1.8 – Scorecard, Politur, Konto-Features, Offline

_Enthält Commit `a6cb9d6` auf Branch `dev-1.1`._

## Was in dieser Version drin ist

| Bereich | Änderung |
| --- | --- |
| Scorecard (v1.4) | Dritter Tab „Stops": alle Stops mit Status, Schlücken, Strafpunkten, Gesamtwert; Antippen öffnet die Challenge |
| Politur (v1.7) | SVG-Icon-Set statt Emojis, Listeneintrag zentriert Karte, Erst-Nutzer-Führung im Dashboard, `prefers-reduced-motion` |
| Konto-Features (v2.0) | „Meine Kneipen" + eigene Spielformen dauerhaft am Konto, Statistiken (Touren, Bestwert) im Dashboard |
| Offline | Tour-Snapshot im localStorage, Wertungs-Warteschlange mit Auto-Nachtrag, Route-Cache, Hinweis-Banner |

---

## Schritt 1 – Supabase (einmalig, vor oder nach dem Deploy)

Nur **eine** neue SQL-Datei ist nötig: `supabase/06_konto_features.sql`.
Sie legt zwei Tabellen für die Konto-Features an (`meine_kneipen`, `meine_spielformen`)
mit strikt privater RLS – jede:r sieht nur die eigenen Einträge.

**So geht's:** Supabase Dashboard → dein Projekt → **SQL Editor** → **New query** →
Inhalt von `supabase/06_konto_features.sql` einfügen → **RUN**.

Das Skript ist idempotent (`create table if not exists`, `drop policy if exists`),
kann also ohne Schaden mehrfach laufen.

### Muss ich sonst etwas in Supabase ändern?

**Nein.** Geprüft:

- **Realtime:** `ergebnisse`, `teilnehmer`, `touren`, `kneipen_challenge` sind bereits
  in `supabase_realtime` publiziert – die Offline-Warteschlange und die Live-Rangliste
  nutzen genau diese Tabellen, keine neuen.
- **RLS bestehender Tabellen:** unverändert (offene `authenticated`-Policies aus
  `03_multiplayer_fix_rls.sql` bleiben gültig).
- **Bestehende Spalten:** Scorecard und Offline-Modus rechnen nur mit vorhandenen
  Feldern (`schlucke`, `strafschlucke`, `erledigt`).

### Wenn du das SQL (noch) nicht ausführst

Die App bricht **nicht** ab: Ohne die Tabellen laufen die Abfragen ins Leere,
„Meine Kneipen" bleibt leer und die Checkbox „Für künftige Touren merken"
fällt still auf das alte Verhalten (nur für diese Tour) zurück.
Alles andere – Scorecard, Icons, Statistiken, Offline – funktioniert sofort.

---

## Schritt 2 – Vercel

Die Produktion hängt an `main` (Stand: `dec2647`), die neuen Features liegen auf
`dev-1.1` (`a6cb9d6`). Vercel deployt automatisch beim Push.

```bash
# im Projektordner
git checkout main
git merge dev-1.1
git push origin main
```

Danach im Vercel-Dashboard den Build beobachten (~1–2 Min).

**Alternative ohne Merge:** In Vercel unter *Settings → Git → Production Branch*
auf `dev-1.1` umstellen und einen Redeploy auslösen.

### Env-Vars prüfen

In Vercel müssen gesetzt sein (Project → Settings → Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SITE_ACCESS_CODE` (optional, Default `casio2005`)

---

## Schritt 3 – Rauchtest auf der Live-URL

1. Zugangscode eingeben, einloggen.
2. Dashboard: Handicap-Karte zeigt zusätzlich „Gespielte Touren" und „Bestwert".
3. Spiel erstellen → Kneipe selbst hinzufügen → **„Für künftige Touren merken"**
   anhaken → speichern. Neues Spiel erstellen: die Kneipe steht unter
   **„Meine Kneipen"** im Picker.
4. Tour starten → Tab **„Stops"**: Liste mit Status und Gesamtwert; Stop antippen
   öffnet die Challenge.
5. Flugmodus an → Schlücke zählen → Banner „wird nachgetragen" erscheint →
   Flugmodus aus → Wertung landet binnen ~8 s in der Rangliste.

## Rollback

Falls etwas hakt: in Vercel unter *Deployments* das vorherige Production-Deployment
auf **Promote to Production** setzen. Die Supabase-Tabellen können bleiben – sie
stören ältere App-Versionen nicht.
