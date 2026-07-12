import { NextResponse } from "next/server";

// Serverseitiger Routing-Proxy (OSRM). Liefert eine straßenfolgende Linie
// zwischen den Stops. Versucht Fuß-Profil, fällt sonst auf Auto zurück.
export const runtime = "nodejs";

type RouteAntwort = { coords: [number, number][]; meters: number; sekunden: number };

async function osrm(profil: string, osrmCoords: string) {
  const url = `https://router.project-osrm.org/route/v1/${profil}/${osrmCoords}?overview=full&geometries=geojson`;
  const r = await fetch(url, { next: { revalidate: 300 } });
  if (!r.ok) return null;
  const d = await r.json();
  const route = d?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) return null;
  return route;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // stops = "lat,lng;lat,lng;..."
  const stops = (searchParams.get("stops") ?? "").trim();
  const punkte = stops
    .split(";")
    .map((p) => p.split(",").map(Number))
    .filter((p) => p.length === 2 && isFinite(p[0]) && isFinite(p[1]));

  if (punkte.length < 2) {
    return NextResponse.json({ coords: [], meters: 0, sekunden: 0 } as RouteAntwort);
  }

  // OSRM erwartet lng,lat
  const osrmCoords = punkte.map(([la, ln]) => `${ln},${la}`).join(";");

  try {
    const route = (await osrm("foot", osrmCoords)) ?? (await osrm("driving", osrmCoords));
    if (!route) return NextResponse.json({ coords: [], meters: 0, sekunden: 0 } as RouteAntwort);
    // GeoJSON ist lng,lat -> zurück zu lat,lng für Leaflet
    const coords: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]]
    );
    return NextResponse.json({
      coords,
      meters: Math.round(route.distance ?? 0),
      sekunden: Math.round(route.duration ?? 0),
    } as RouteAntwort);
  } catch {
    return NextResponse.json({ coords: [], meters: 0, sekunden: 0 } as RouteAntwort);
  }
}
