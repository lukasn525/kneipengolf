/**
 * Automatische Stadt-Zuordnung für neue Bars.
 *
 * Der Geocoder liefert einen Ortsnamen – der passt aber nicht immer auf
 * eine unserer Städte: „Köln-Ehrenfeld", „Rhein-Sieg-Kreis" oder eine
 * Vorortgemeinde stehen genauso drin wie „Bonn". Deshalb zwei Stufen:
 *
 *  1. Namensvergleich (normalisiert, auch als Teilstring) – die sichere Bank.
 *  2. Nächstgelegene Stadt innerhalb eines Radius – fängt Stadtteile und
 *     Vororte ab, ohne eine Ortsliste pflegen zu müssen.
 *
 * Findet keine Stufe etwas, bleibt die Zuordnung leer. Das ist ausdrücklich
 * erlaubt: `bars.stadt_id` ist optional, und eine falsche Stadt wäre
 * schlimmer als gar keine.
 */

import type { Stadt } from "./types";

/** Radius, in dem eine Bar noch zur Stadt gezählt wird. */
const RADIUS_KM = 25;

/** Kleinschreibung ohne Umlaute/ß – „Düsseldorf" == „duesseldorf". */
export function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Luftlinie in Kilometern (Haversine). */
export function distanzKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Ortstreffer = {
  stadt: Stadt;
  /** Woher die Zuordnung kommt – nur für den Hinweistext in der UI. */
  quelle: "name" | "naehe";
};

/**
 * Ordnet eine Position (und optional den Ortsnamen des Geocoders) einer
 * bekannten Stadt zu. `null`, wenn nichts sicher genug passt.
 */
export function erkenneStadt(
  staedte: Stadt[],
  ziel: { ort?: string | null; lat: number; lng: number }
): Ortstreffer | null {
  if (!staedte.length) return null;

  // 1. Name – „Köln-Ehrenfeld" enthält „Köln", deshalb auch Teilstring.
  if (ziel.ort) {
    const o = normalisiere(ziel.ort);
    const treffer =
      staedte.find((s) => normalisiere(s.name) === o) ??
      staedte.find((s) => o.includes(normalisiere(s.name)));
    if (treffer) return { stadt: treffer, quelle: "name" };
  }

  // 2. Nähe – fängt Vororte und Stadtteile mit eigenem Namen ab.
  let beste: Stadt | null = null;
  let besteDistanz = Infinity;
  for (const s of staedte) {
    const d = distanzKm([ziel.lat, ziel.lng], [s.lat, s.lng]);
    if (d < besteDistanz) {
      besteDistanz = d;
      beste = s;
    }
  }
  if (beste && besteDistanz <= RADIUS_KM) return { stadt: beste, quelle: "naehe" };

  return null;
}
