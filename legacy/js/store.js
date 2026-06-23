// Speicher-Schicht
// ──────────────────────────────────────────────────────────────
// Einheitliche async-API für den Rest der App. Intern entweder
// localStorage (kein Backend) oder Supabase (persistent, geräteübergreifend).
// Der Rest der App muss nicht wissen, welcher Modus aktiv ist.

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AKTIV } from "./config.js";
import { KNEIPEN, SPIELFORMEN } from "./data.js";

let sb = null; // Supabase-Client, nur bei Bedarf geladen

async function client() {
  if (sb) return sb;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sb;
}

// ── Stammdaten ────────────────────────────────────────────────

export async function ladeKneipen() {
  if (!SUPABASE_AKTIV) return KNEIPEN;
  const { data, error } = await (await client())
    .from("kneipen").select("*").order("sortierung");
  if (error) { console.warn("Kneipen-Laden fehlgeschlagen, nutze lokale Daten", error); return KNEIPEN; }
  return data;
}

export async function ladeSpielformen() {
  if (!SUPABASE_AKTIV) return SPIELFORMEN;
  const { data, error } = await (await client()).from("spielformen").select("*");
  if (error) { console.warn("Spielformen-Laden fehlgeschlagen, nutze lokale Daten", error); return SPIELFORMEN; }
  return data;
}

// ── Fortschritt (lokal) ───────────────────────────────────────
// Form: { [kneipeId]: { spielformId, schlucke, erledigt } }

const LS_KEY = (code) => `kneipen-challenge:${code}`;

function lokalLaden(code) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(code))) || {}; }
  catch { return {}; }
}
function lokalSpeichern(code, stand) {
  localStorage.setItem(LS_KEY(code), JSON.stringify(stand));
}

// ── Fortschritt (öffentliche API) ─────────────────────────────

export async function ladeFortschritt(code) {
  if (!SUPABASE_AKTIV) return lokalLaden(code);

  const c = await client();
  const { data: tour } = await c.from("touren").select("id").eq("code", code).maybeSingle();
  if (!tour) return {};
  const { data } = await c.from("fortschritt").select("*").eq("tour_id", tour.id);
  const stand = {};
  (data || []).forEach(z => {
    stand[z.kneipe_id] = { spielformId: z.spielform_id, schlucke: z.schlucke, erledigt: z.erledigt };
  });
  return stand;
}

export async function speichereKneipenStand(code, kneipeId, eintrag) {
  if (!SUPABASE_AKTIV) {
    const stand = lokalLaden(code);
    stand[kneipeId] = eintrag;
    lokalSpeichern(code, stand);
    return;
  }
  const c = await client();
  // Tour bei Bedarf anlegen
  let { data: tour } = await c.from("touren").select("id").eq("code", code).maybeSingle();
  if (!tour) {
    const { data } = await c.from("touren").insert({ code }).select("id").single();
    tour = data;
  }
  await c.from("fortschritt").upsert({
    tour_id: tour.id,
    kneipe_id: kneipeId,
    spielform_id: eintrag.spielformId,
    schlucke: eintrag.schlucke,
    erledigt: eintrag.erledigt,
    erledigt_am: eintrag.erledigt ? new Date().toISOString() : null,
  }, { onConflict: "tour_id,kneipe_id" });
}
