export type RouteInfo = { coords: [number, number][]; meters: number; sekunden: number };

/**
 * Holt eine straßenfolgende Route (über /api/route) zwischen den Punkten.
 * Erfolgreiche Antworten werden lokal gecacht – bei schlechtem Netz (Kneipe!)
 * kommt die zuletzt bekannte Route zurück statt gar keiner.
 */
export async function holeRoute(punkte: [number, number][]): Promise<RouteInfo | null> {
  if (punkte.length < 2) return null;
  const stops = punkte.map(([la, ln]) => `${la},${ln}`).join(";");
  const cacheKey = `kg-route-${stops}`;
  try {
    const r = await fetch(`/api/route?stops=${encodeURIComponent(stops)}`);
    const d = await r.json();
    if (!d?.coords?.length) throw new Error("leer");
    try {
      localStorage.setItem(cacheKey, JSON.stringify(d));
    } catch {
      /* Quota voll – Cache ist nur nice-to-have */
    }
    return d as RouteInfo;
  } catch {
    try {
      const roh = localStorage.getItem(cacheKey);
      if (roh) return JSON.parse(roh) as RouteInfo;
    } catch {
      /* defekter Cache – ignorieren */
    }
    return null;
  }
}

/** Reverse-Geocoding: Koordinaten -> { name, label }. */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ name: string; label: string } | null> {
  try {
    const r = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`);
    const d = await r.json();
    const t = d?.ergebnisse?.[0];
    if (!t) return null;
    return { name: t.name as string, label: t.label as string };
  } catch {
    return null;
  }
}

/** Google-Maps-Navigations-Link (zu Fuß) über alle Stops in Reihenfolge. */
export function googleMapsUrl(punkte: [number, number][]): string {
  if (!punkte.length) return "https://maps.google.com";
  const origin = punkte[0];
  const ziel = punkte[punkte.length - 1];
  const p = new URLSearchParams({
    api: "1",
    origin: `${origin[0]},${origin[1]}`,
    destination: `${ziel[0]},${ziel[1]}`,
    travelmode: "walking",
  });
  const waypoints = punkte
    .slice(1, -1)
    .map(([la, ln]) => `${la},${ln}`)
    .join("|");
  if (waypoints) p.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}
