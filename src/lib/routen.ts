"use client";

/**
 * Zugriffsschicht für gespeicherte Routen.
 *
 * Eine Route ist eine Vorlage, kein Spiel: sie hält Name, optionale
 * Beschreibung und eine geordnete Liste von Stops. Gespielt wird immer
 * über eine Tour – die Route füllt dabei nur die Stopliste vor.
 *
 * Regeln, die hier – und nur hier – zentral gelten:
 *  • Routennamen sind pro Nutzer:in eindeutig. `freierRoutenName` erzeugt
 *    einen Vorschlag, die Datenbank erzwingt die Regel per unique index.
 *  • Neue Routen entstehen IMMER privat. Veröffentlichen ist ein eigener,
 *    bewusster Schritt – wie bei Bars und Spielformen.
 *  • Teilen läuft über den `teilen_token` im Link. Vorschau und Übernahme
 *    gehen über zwei RPCs, damit der Token nirgends in einer Policy landet.
 */

import { supabase } from "./supabaseClient";
import type { Route, RoutenStop, Sichtbarkeit } from "./types";

/** Ein Stop, wie ihn die Spielerstellung und die Vorschau benutzen. */
export type StopEingabe = {
  name: string;
  lat: number;
  lng: number;
  adresse: string | null;
  barId?: string | null;
};

export type RouteMitStops = Route & { stops: RoutenStop[] };

export type RoutenListe = {
  /** eigene Routen (privat + veröffentlicht) */
  eigene: RouteMitStops[];
  /** öffentliche Routen anderer Spieler:innen */
  community: RouteMitStops[];
};

type StopRow = Omit<RoutenStop, "id" | "route_id"> & { id?: string };

// ── Laden ─────────────────────────────────────────────────────────

/**
 * Lädt alle sichtbaren Routen samt Stops in zwei Abfragen und gruppiert
 * sie nach Herkunft. RLS filtert serverseitig – hier wird nur einsortiert.
 */
export async function ladeRouten(userId: string | undefined): Promise<RoutenListe> {
  const sb = supabase();
  const { data, error } = await sb
    .from("routen")
    .select("*")
    .order("geaendert_am", { ascending: false });
  if (error || !data) return { eigene: [], community: [] };

  const routen = data as Route[];
  const stops = await ladeStops(routen.map((r) => r.id));
  const mit = routen.map((r) => ({ ...r, stops: stops.get(r.id) ?? [] }));

  return {
    eigene: mit.filter((r) => r.ersteller_user_id === userId),
    community: mit.filter((r) => r.ersteller_user_id !== userId),
  };
}

async function ladeStops(routeIds: string[]): Promise<Map<string, RoutenStop[]>> {
  const map = new Map<string, RoutenStop[]>();
  if (!routeIds.length) return map;
  const { data } = await supabase()
    .from("routen_stops")
    .select("*")
    .in("route_id", routeIds)
    .order("position");
  for (const s of ((data as RoutenStop[]) ?? [])) {
    const liste = map.get(s.route_id);
    if (liste) liste.push(s);
    else map.set(s.route_id, [s]);
  }
  return map;
}

/** Einzelne Route inkl. Stops – für Schnellstart über `?route=…`. */
export async function ladeRoute(routeId: string): Promise<RouteMitStops | null> {
  const sb = supabase();
  const { data } = await sb.from("routen").select("*").eq("id", routeId).maybeSingle();
  if (!data) return null;
  const stops = await ladeStops([routeId]);
  return { ...(data as Route), stops: stops.get(routeId) ?? [] };
}

export type GespielteRoute = RouteMitStops & { zuletztGespielt: string };

/**
 * Routen, die wirklich schon auf dem Tisch lagen – für „Nochmal spielen".
 *
 * „Gespielt" heisst: es gab eine Tour aus dieser Route, die den Lobby-
 * Zustand verlassen hat. Eine angelegte, aber nie gestartete Route taucht
 * hier bewusst nicht auf; dafür ist der Routen-Tab da.
 */
export async function ladeGespielteRouten(
  userId: string | undefined,
  anzahl = 3
): Promise<GespielteRoute[]> {
  if (!userId) return [];
  const sb = supabase();
  const { data } = await sb
    .from("touren")
    .select("route_id,erstellt_am")
    .eq("host_user_id", userId)
    .not("route_id", "is", null)
    .in("status", ["laufend", "beendet"])
    .order("erstellt_am", { ascending: false })
    .limit(60);

  const rows = (data as { route_id: string; erstellt_am: string }[]) ?? [];

  // Pro Route nur das jüngste Spiel; Reihenfolge bleibt „zuletzt zuerst".
  const zuletzt = new Map<string, string>();
  for (const r of rows) if (!zuletzt.has(r.route_id)) zuletzt.set(r.route_id, r.erstellt_am);
  const ids = [...zuletzt.keys()].slice(0, anzahl);
  if (!ids.length) return [];

  // RLS entscheidet mit: gelöschte oder zurückgezogene Routen fallen raus.
  const { data: rd } = await sb.from("routen").select("*").in("id", ids);
  const routen = (rd as Route[]) ?? [];
  const stops = await ladeStops(routen.map((r) => r.id));

  return ids
    .map((id) => routen.find((r) => r.id === id))
    .filter((r): r is Route => Boolean(r))
    .map((r) => ({
      ...r,
      stops: stops.get(r.id) ?? [],
      zuletztGespielt: zuletzt.get(r.id) as string,
    }));
}

/** Nur die Namen der eigenen Routen – Grundlage für die Namensprüfung. */
export async function eigeneRoutenNamen(userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  const { data } = await supabase()
    .from("routen")
    .select("name")
    .eq("ersteller_user_id", userId);
  return ((data as { name: string }[]) ?? []).map((r) => r.name);
}

// ── Namensregel ───────────────────────────────────────────────────

/** Ist der Name für diese Person noch frei? (Gross-/Kleinschreibung egal) */
export function nameFrei(name: string, vorhandene: string[], ausserId?: string): boolean {
  void ausserId;
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return !vorhandene.some((v) => v.trim().toLowerCase() === n);
}

/**
 * Macht aus „Kölntour" den ersten freien Namen: „Kölntour (2)", „(3)", …
 * Ist der Wunschname frei, kommt er unverändert zurück.
 */
export function freierRoutenName(wunsch: string, vorhandene: string[]): string {
  const basis = wunsch.trim() || "Meine Route";
  if (nameFrei(basis, vorhandene)) return basis;
  // Ein vorhandenes „ (n)" am Ende nicht stapeln, sondern hochzählen
  const kern = basis.replace(/\s*\(\d+\)\s*$/, "");
  for (let i = 2; i < 200; i++) {
    const kandidat = `${kern} (${i})`;
    if (nameFrei(kandidat, vorhandene)) return kandidat;
  }
  return `${kern} ${Date.now()}`;
}

// ── Anlegen & pflegen ─────────────────────────────────────────────

export type RoutenFehler = "name_belegt" | "name_leer" | "unbekannt" | "nicht_angemeldet" | "eigene_route";

export type SpeicherErgebnis =
  | { ok: true; route: Route }
  | { ok: false; fehler: RoutenFehler; meldung: string };

const FEHLERTEXT: Record<RoutenFehler, string> = {
  name_belegt: "Du hast schon eine Route mit diesem Namen. Wähle einen anderen.",
  name_leer: "Die Route braucht einen Namen.",
  unbekannt: "Diese Route gibt es nicht (mehr) oder sie wurde gesperrt.",
  nicht_angemeldet: "Zum Speichern musst du angemeldet sein.",
  eigene_route: "Das ist bereits deine eigene Route.",
};

/** Postgres meldet den Verstoss gegen den unique index mit Code 23505. */
function istNamensKonflikt(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23505" || Boolean(error?.message?.includes("routen_name_pro_user"));
}

/** Legt eine neue Route mit Stops an – immer privat. */
export async function routeSpeichern(
  userId: string,
  daten: { name: string; beschreibung?: string | null; stadtId?: number | null },
  stops: StopEingabe[]
): Promise<SpeicherErgebnis> {
  const name = daten.name.trim();
  if (!name) return { ok: false, fehler: "name_leer", meldung: FEHLERTEXT.name_leer };

  const sb = supabase();
  const { data, error } = await sb
    .from("routen")
    .insert({
      name,
      beschreibung: daten.beschreibung?.trim() || null,
      stadt_id: daten.stadtId ?? null,
      ersteller_user_id: userId,
      sichtbarkeit: "privat",
    })
    .select()
    .single();

  if (error || !data) {
    const fehler: RoutenFehler = istNamensKonflikt(error) ? "name_belegt" : "unbekannt";
    return { ok: false, fehler, meldung: FEHLERTEXT[fehler] };
  }

  const route = data as Route;
  const ok = await stopsSchreiben(route.id, stops);
  if (!ok) {
    await sb.from("routen").delete().eq("id", route.id); // kein halbes Ergebnis stehen lassen
    return { ok: false, fehler: "unbekannt", meldung: "Die Stops konnten nicht gespeichert werden." };
  }
  return { ok: true, route };
}

/** Ersetzt die Stops einer Route (Reihenfolge = Array-Reihenfolge). */
export async function stopsSchreiben(routeId: string, stops: StopEingabe[]): Promise<boolean> {
  const sb = supabase();
  await sb.from("routen_stops").delete().eq("route_id", routeId);
  if (!stops.length) return true;
  const rows: (StopRow & { route_id: string })[] = stops.map((s, i) => ({
    route_id: routeId,
    bar_id: s.barId ?? null,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    adresse: s.adresse,
    position: i,
  }));
  const { error } = await sb.from("routen_stops").insert(rows);
  return !error;
}

/** Aktualisiert eine bestehende Route (Stops optional). */
export async function routeAktualisieren(
  routeId: string,
  daten: { name?: string; beschreibung?: string | null; stadtId?: number | null },
  stops?: StopEingabe[]
): Promise<SpeicherErgebnis> {
  const sb = supabase();
  const patch: Record<string, unknown> = {};
  if (daten.name !== undefined) {
    const name = daten.name.trim();
    if (!name) return { ok: false, fehler: "name_leer", meldung: FEHLERTEXT.name_leer };
    patch.name = name;
  }
  if (daten.beschreibung !== undefined) patch.beschreibung = daten.beschreibung?.trim() || null;
  if (daten.stadtId !== undefined) patch.stadt_id = daten.stadtId;

  const { data, error } = await sb
    .from("routen")
    .update(patch)
    .eq("id", routeId)
    .select()
    .single();
  if (error || !data) {
    const fehler: RoutenFehler = istNamensKonflikt(error) ? "name_belegt" : "unbekannt";
    return { ok: false, fehler, meldung: FEHLERTEXT[fehler] };
  }
  if (stops) {
    const ok = await stopsSchreiben(routeId, stops);
    if (!ok) return { ok: false, fehler: "unbekannt", meldung: "Die Stops konnten nicht gespeichert werden." };
  }
  return { ok: true, route: data as Route };
}

export async function routeSichtbarkeitSetzen(routeId: string, sichtbarkeit: Sichtbarkeit) {
  const { error } = await supabase().from("routen").update({ sichtbarkeit }).eq("id", routeId);
  return !error;
}

export async function routeLoeschen(routeId: string) {
  const { error } = await supabase().from("routen").delete().eq("id", routeId);
  return !error;
}

/** Nur Moderation: global sperren/entsperren. */
export async function routeSperren(routeId: string, gesperrt: boolean) {
  const { error } = await supabase().from("routen").update({ gesperrt }).eq("id", routeId);
  return !error;
}

// ── Teilen & Übernehmen ───────────────────────────────────────────

/** Der Link, den man weitergibt. */
export function teilenUrl(token: string): string {
  const basis = typeof window === "undefined" ? "" : window.location.origin;
  return `${basis}/route/${token}`;
}

export type RoutenVorschau = {
  route: {
    id: string;
    name: string;
    beschreibung: string | null;
    stadt_id: number | null;
    sichtbarkeit: Sichtbarkeit;
    teilen_token: string;
    erstellt_am: string;
    ist_eigene: boolean;
  };
  stops: { name: string; lat: number; lng: number; adresse: string | null; position: number }[];
};

/**
 * Vorschau zu einem geteilten Link. Läuft über eine `security definer`-
 * Funktion und funktioniert deshalb auch für private Routen – aber nur
 * mit gültigem Token, und ohne dass dabei fremde Bars lesbar werden.
 */
export async function routeVorschau(token: string): Promise<RoutenVorschau | null> {
  const { data, error } = await supabase().rpc("route_per_token", { p_token: token });
  if (error || !data) return null;
  const d = data as { gefunden: boolean } & RoutenVorschau;
  return d.gefunden ? { route: d.route, stops: d.stops ?? [] } : null;
}

export type UebernahmeErgebnis =
  | { ok: true; routeId: string; name: string }
  | { ok: false; fehler: RoutenFehler; meldung: string };

/**
 * Übernimmt eine geteilte Route als eigene, private Kopie.
 *
 * Die Bar-Auflösung passiert bewusst in der Datenbank: öffentliche Bars
 * bleiben referenziert, fremde private Bars werden einmalig als eigene
 * Kopie angelegt und in der Bibliothek als „übernommen" markiert.
 */
export async function routeUebernehmen(
  token: string,
  name: string
): Promise<UebernahmeErgebnis> {
  const { data, error } = await supabase().rpc("route_uebernehmen", {
    p_token: token,
    p_name: name,
  });
  if (error || !data) {
    const fehler: RoutenFehler = istNamensKonflikt(error) ? "name_belegt" : "unbekannt";
    return { ok: false, fehler, meldung: FEHLERTEXT[fehler] };
  }
  const d = data as { ok: boolean; route_id?: string; name?: string; fehler?: RoutenFehler };
  if (d.ok && d.route_id) return { ok: true, routeId: d.route_id, name: d.name ?? name };
  const fehler = d.fehler ?? "unbekannt";
  return { ok: false, fehler, meldung: FEHLERTEXT[fehler] ?? FEHLERTEXT.unbekannt };
}
