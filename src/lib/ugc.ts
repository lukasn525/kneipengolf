"use client";

/**
 * Zugriffsschicht für User-Generated Content (Bars & Spielformen).
 *
 * Regeln, die hier – und nur hier – zentral gelten:
 *  • Neue Inhalte werden IMMER privat angelegt. Veröffentlichen ist ein
 *    eigener, bewusster Schritt (`barVeroeffentlichen`). Die Datenbank
 *    erzwingt das zusätzlich per RLS, damit Bars aus einer Route nie
 *    versehentlich global landen.
 *  • Ausblenden ist rein persönlich und löscht nichts.
 *  • Rechte werden nicht im Frontend „erfunden": `darfBearbeiten` spiegelt
 *    exakt die RLS-Policies, damit die UI nur anbietet, was durchgeht.
 */

import { supabase } from "./supabaseClient";
import { tagsFuerSpeichern } from "./tags";
import type { Bar, BenutzerRolle, Sichtbarkeit, Spielform } from "./types";

// Hier stand bis v5.0 eine `geraetId()` aus dem localStorage, an der
// Pass-and-Play hing. Sie ist ersatzlos weg: Gäste hängen jetzt an
// `teilnehmer.verwaltet_von`, also am Konto. Das übersteht gelöschte
// Browserdaten und einen Handywechsel – und ist im Gegensatz zu einer
// selbst gemeldeten Geräte-ID überhaupt prüfbar.

// ── Rollen ────────────────────────────────────────────────────────
export async function ladeRolle(userId: string | undefined): Promise<BenutzerRolle> {
  if (!userId) return null;
  const { data } = await supabase()
    .from("benutzer_rollen")
    .select("rolle")
    .eq("user_id", userId)
    .maybeSingle();
  const r = (data as { rolle?: string } | null)?.rolle;
  return r === "admin" || r === "moderator" ? r : null;
}

export function istModerator(rolle: BenutzerRolle): boolean {
  return rolle === "admin" || rolle === "moderator";
}

/** Spiegelt die RLS-Policy: Ersteller (solange nicht gesperrt) oder Moderation. */
export function darfBearbeiten(
  eintrag: { ersteller_user_id?: string | null; gesperrt?: boolean },
  userId: string | undefined,
  rolle: BenutzerRolle
): boolean {
  if (istModerator(rolle)) return true;
  if (!userId || !eintrag.ersteller_user_id) return false;
  return eintrag.ersteller_user_id === userId && !eintrag.gesperrt;
}

// ── Bars ──────────────────────────────────────────────────────────

export type BarListe = {
  /** kuratiert vom Team (ersteller_user_id === null) */
  kuratiert: Bar[];
  /** öffentlich, von anderen Spielern beigetragen */
  community: Bar[];
  /** eigene Bars (privat + veröffentlicht) */
  eigene: Bar[];
  /** IDs, die dieser Nutzer für sich ausgeblendet hat */
  ausgeblendet: Set<string>;
};

/**
 * Lädt alle für diesen Nutzer sichtbaren Bars, gruppiert nach Herkunft.
 * RLS filtert serverseitig – hier wird nur einsortiert.
 */
export async function ladeBars(
  userId: string | undefined,
  stadtId?: number | null
): Promise<BarListe> {
  const sb = supabase();
  // Filter VOR order anwenden (Query-Builder-Typen), Stadtfilter nur auf
  // fremde Bars – eigene sollen immer sichtbar sein, auch ohne Stadtbezug.
  let f = sb.from("bars").select("*");
  if (stadtId && userId) {
    f = f.or(`stadt_id.eq.${stadtId},ersteller_user_id.eq.${userId}`);
  } else if (stadtId) {
    f = f.eq("stadt_id", stadtId);
  }
  const [{ data, error }, ausbl] = await Promise.all([
    f.order("sortierung").order("name"),
    ladeBarAusblendungen(userId),
  ]);
  if (error || !data) return { kuratiert: [], community: [], eigene: [], ausgeblendet: ausbl };

  const alle = data as Bar[];
  return {
    kuratiert: alle.filter((b) => !b.ersteller_user_id),
    community: alle.filter((b) => b.ersteller_user_id && b.ersteller_user_id !== userId),
    eigene: alle.filter((b) => b.ersteller_user_id === userId),
    ausgeblendet: ausbl,
  };
}

async function ladeBarAusblendungen(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await supabase()
    .from("bar_ausblendungen")
    .select("bar_id")
    .eq("user_id", userId);
  return new Set(((data as { bar_id: string }[]) ?? []).map((r) => r.bar_id));
}

/** Legt eine Bar an – bewusst immer privat (Routen-Ausnahme). */
export async function barAnlegen(
  userId: string,
  bar: {
    name: string;
    lat: number;
    lng: number;
    adresse?: string | null;
    stadt_id?: number | null;
    tags?: string[];
  }
): Promise<Bar | null> {
  const { data, error } = await supabase()
    .from("bars")
    .insert({
      name: bar.name.trim(),
      lat: bar.lat,
      lng: bar.lng,
      adresse: bar.adresse ?? null,
      stadt_id: bar.stadt_id ?? null,
      ersteller_user_id: userId,
      sichtbarkeit: "privat",
      // Immer durch `tagsFuerSpeichern` – die Datenbank prüft nur die
      // Anzahl, das Vokabular hält allein der Client sauber.
      tags: tagsFuerSpeichern(bar.tags ?? []),
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as Bar;
}

export async function barSichtbarkeitSetzen(
  barId: string,
  sichtbarkeit: Sichtbarkeit
): Promise<boolean> {
  const { error } = await supabase().from("bars").update({ sichtbarkeit }).eq("id", barId);
  return !error;
}

export async function barUmbenennen(barId: string, name: string): Promise<boolean> {
  const { error } = await supabase().from("bars").update({ name: name.trim() }).eq("id", barId);
  return !error;
}

/**
 * Setzt die Tags einer Bar neu (ersetzend, nicht ergänzend).
 *
 * Wer das darf, entscheidet die RLS-Policy `bars_aendern` – Ersteller
 * oder Moderation. Die UI bietet es nur an, wo `darfBearbeiten` gilt;
 * geht doch etwas durch, blockt die Datenbank.
 */
export async function barTagsSetzen(barId: string, tags: string[]): Promise<boolean> {
  const { error } = await supabase()
    .from("bars")
    .update({ tags: tagsFuerSpeichern(tags) })
    .eq("id", barId);
  return !error;
}

/**
 * Löscht eine Bar endgültig. Gefahrlos: `tour_kneipen` hält einen Snapshot,
 * bestehende Touren behalten Name und Position, nur `bar_id` wird NULL.
 */
export async function barLoeschen(barId: string): Promise<boolean> {
  const { error } = await supabase().from("bars").delete().eq("id", barId);
  return !error;
}

/** Nur Moderation: global sperren/entsperren. */
export async function barSperren(barId: string, gesperrt: boolean): Promise<boolean> {
  const { error } = await supabase().from("bars").update({ gesperrt }).eq("id", barId);
  return !error;
}

export async function barAusblenden(userId: string, barId: string, aus: boolean) {
  const sb = supabase();
  if (aus) {
    await sb.from("bar_ausblendungen").upsert(
      { user_id: userId, bar_id: barId },
      { onConflict: "user_id,bar_id" }
    );
  } else {
    await sb.from("bar_ausblendungen").delete().eq("user_id", userId).eq("bar_id", barId);
  }
}

export async function barMelden(userId: string, barId: string, grund: string) {
  await supabase()
    .from("bar_meldungen")
    .upsert({ user_id: userId, bar_id: barId, grund }, { onConflict: "bar_id,user_id" });
}

// ── Spielformen ───────────────────────────────────────────────────

export type SpielformListe = {
  global: Spielform[];
  community: Spielform[];
  eigene: Spielform[];
  ausgeblendet: Set<number>;
};

export async function ladeSpielformen(userId: string | undefined): Promise<SpielformListe> {
  const sb = supabase();
  const [{ data, error }, ausbl] = await Promise.all([
    sb.from("spielformen").select("*").order("id"),
    ladeSpielformAusblendungen(userId),
  ]);
  if (error || !data) return { global: [], community: [], eigene: [], ausgeblendet: ausbl };
  const alle = data as Spielform[];
  return {
    global: alle.filter((s) => !s.ersteller_user_id),
    community: alle.filter((s) => s.ersteller_user_id && s.ersteller_user_id !== userId),
    eigene: alle.filter((s) => s.ersteller_user_id === userId),
    ausgeblendet: ausbl,
  };
}

async function ladeSpielformAusblendungen(userId: string | undefined): Promise<Set<number>> {
  if (!userId) return new Set();
  const { data } = await supabase()
    .from("spielform_ausblendungen")
    .select("spielform_id")
    .eq("user_id", userId);
  return new Set(((data as { spielform_id: number }[]) ?? []).map((r) => r.spielform_id));
}

/** Neue Spielform – ebenfalls immer privat, Veröffentlichen ist ein extra Schritt. */
export async function spielformAnlegen(
  userId: string,
  titel: string,
  beschreibung: string
): Promise<Spielform | null> {
  const { data, error } = await supabase()
    .from("spielformen")
    .insert({
      titel: titel.trim(),
      beschreibung: beschreibung.trim(),
      schwierigkeit: 1,
      ersteller_user_id: userId,
      sichtbarkeit: "privat",
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as Spielform;
}

export async function spielformSichtbarkeitSetzen(id: number, sichtbarkeit: Sichtbarkeit) {
  const { error } = await supabase().from("spielformen").update({ sichtbarkeit }).eq("id", id);
  return !error;
}

export async function spielformLoeschen(id: number) {
  const { error } = await supabase().from("spielformen").delete().eq("id", id);
  return !error;
}

export async function spielformAusblenden(userId: string, id: number, aus: boolean) {
  const sb = supabase();
  if (aus) {
    await sb.from("spielform_ausblendungen").upsert(
      { user_id: userId, spielform_id: id },
      { onConflict: "user_id,spielform_id" }
    );
  } else {
    await sb
      .from("spielform_ausblendungen")
      .delete()
      .eq("user_id", userId)
      .eq("spielform_id", id);
  }
}
