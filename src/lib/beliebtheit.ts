"use client";

/**
 * Beliebtheit von Bars.
 *
 * Der Index misst Zuspruch, nicht Qualität: wie viele verschiedene
 * Menschen eine Bar empfohlen, dort gespielt, sie in eine öffentliche
 * Route gepackt oder in ihre Liste übernommen haben. Gerechnet wird in
 * der Datenbank (View `bar_beliebtheit`) – hier steht nur der Zugriff
 * und die Übersetzung in etwas Anzeigbares.
 */

import { supabase } from "./supabaseClient";

export type Beliebtheit = {
  bar_id: string;
  /** Bewusste Empfehlungen nach einem Spiel (distinct Personen) */
  empfehlungen: number;
  /** Touren, in denen die Bar gespielt wurde */
  touren: number;
  /** Verschiedene Gruppen (Hosts), die dort gespielt haben */
  gruppen: number;
  /** Öffentliche Routen verschiedener Leute, die sie enthalten */
  routen: number;
  /** Wie oft aus einer geteilten Route übernommen */
  uebernahmen: number;
  /** Gewichtete Summe – die Sortiergrösse */
  punkte: number;
};

export type BeliebtheitMap = Map<string, Beliebtheit>;

/**
 * Leerer Startwert. Als Funktion, weil `Map` in Seiten mit dynamisch
 * geladener Leaflet-Karte vom Komponentennamen `Map` verdeckt wird.
 */
export function leereBeliebtheit(): BeliebtheitMap {
  return new Map();
}

/**
 * Holt die Kennzahlen zu einer Menge von Bars.
 *
 * Bewusst als eigener Aufruf statt als Join: `bars` wird an vielen
 * Stellen geladen, die Beliebtheit braucht aber nur die Bibliothek und
 * der Picker. So bleibt der heisse Pfad (Spiel starten) unberührt.
 */
export async function ladeBeliebtheit(barIds: string[]): Promise<BeliebtheitMap> {
  const map = leereBeliebtheit();
  if (!barIds.length) return map;
  const { data } = await supabase()
    .from("bar_beliebtheit")
    .select("*")
    .in("bar_id", barIds);
  for (const z of ((data as Beliebtheit[]) ?? [])) map.set(z.bar_id, z);
  return map;
}

export function punkte(b: Beliebtheit | undefined): number {
  return b?.punkte ?? 0;
}

/**
 * Stufen statt einer nackten Zahl.
 *
 * „37 Punkte" sagt niemandem etwas, „beliebt" schon. Die Schwellen sind
 * so gesetzt, dass ein einzelnes Spiel einer einzelnen Gruppe (3 Punkte)
 * noch KEINE Marke ergibt – sonst trüge nach dem ersten Abend alles ein
 * Abzeichen und die Auszeichnung wäre wertlos. Ab zwei Gruppen oder einer
 * bewussten Empfehlung wird es interessant.
 */
export type Stufe = { rang: 0 | 1 | 2 | 3; label: string };

export function stufe(b: Beliebtheit | undefined): Stufe {
  const p = punkte(b);
  if (p >= 25) return { rang: 3, label: "Klassiker" };
  if (p >= 10) return { rang: 2, label: "beliebt" };
  if (p >= 5) return { rang: 1, label: "gefragt" };
  return { rang: 0, label: "neu" };
}

/** Klartext für die Zeile unter dem Namen – nur, was tatsächlich vorkommt. */
export function beliebtheitText(b: Beliebtheit | undefined): string | null {
  if (!b || b.punkte === 0) return null;
  const teile: string[] = [];
  if (b.empfehlungen > 0) teile.push(`${b.empfehlungen}× empfohlen`);
  if (b.gruppen > 0) teile.push(`${b.gruppen} ${b.gruppen === 1 ? "Gruppe" : "Gruppen"}`);
  if (b.routen > 0) teile.push(`in ${b.routen} ${b.routen === 1 ? "Route" : "Routen"}`);
  return teile.length ? teile.join(" · ") : null;
}

/** Sortierhilfe: beliebteste zuerst, bei Gleichstand alphabetisch. */
export function nachBeliebtheit<T extends { id: string; name: string }>(
  liste: T[],
  werte: BeliebtheitMap
): T[] {
  return [...liste].sort((a, b) => {
    const d = punkte(werte.get(b.id)) - punkte(werte.get(a.id));
    return d !== 0 ? d : a.name.localeCompare(b.name, "de");
  });
}

// ── Empfehlungen abgeben ──────────────────────────────────────────

/**
 * Empfehlungen dieser Person für eine bestimmte Tour.
 * Grundlage für den „schon empfohlen"-Zustand der Chips am Tourende.
 */
export async function ladeEigeneEmpfehlungen(
  userId: string | undefined,
  tourId: string
): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await supabase()
    .from("bar_empfehlungen")
    .select("bar_id")
    .eq("user_id", userId)
    .eq("tour_id", tourId);
  return new Set(((data as { bar_id: string }[]) ?? []).map((r) => r.bar_id));
}

/**
 * Empfehlung setzen oder zurücknehmen.
 *
 * Die Datenbank lässt das nur zu, wenn man an dieser Tour teilgenommen
 * hat und die Bar dort auch auf der Route stand – das Frontend muss
 * (und kann) das nicht selbst absichern.
 */
export async function empfehlungSetzen(
  userId: string,
  tourId: string,
  barId: string,
  an: boolean
): Promise<boolean> {
  const sb = supabase();
  if (!an) {
    const { error } = await sb
      .from("bar_empfehlungen")
      .delete()
      .eq("user_id", userId)
      .eq("bar_id", barId);
    return !error;
  }
  const { error } = await sb
    .from("bar_empfehlungen")
    .upsert({ user_id: userId, bar_id: barId, tour_id: tourId }, { onConflict: "bar_id,user_id" });
  return !error;
}
