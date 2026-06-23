// Konfiguration
// ──────────────────────────────────────────────────────────────
// Solange URL/KEY leer sind, läuft die App komplett lokal
// (Speicherung im Browser via localStorage). Das ist Schritt 1+2.
//
// Für persistentes Speichern über mehrere Geräte (Schritt 3):
//   1. Auf supabase.com ein kostenloses Projekt anlegen.
//   2. Im SQL-Editor die Datei supabase/schema.sql ausführen.
//   3. Unter "Project Settings → API" Project URL und anon-Key kopieren
//      und hier eintragen.

export const SUPABASE_URL = "";      // z.B. "https://abcd.supabase.co"
export const SUPABASE_ANON_KEY = ""; // der öffentliche "anon public" Key

export const SUPABASE_AKTIV = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Kartenausschnitt beim Start (Zentrum + Zoomstufe)
export const KARTE_START = { lat: 50.7344, lng: 7.0989, zoom: 14 };
