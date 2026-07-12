import { NextResponse } from "next/server";

// Serverseitiger Geocoding-Proxy (Photon / OpenStreetMap).
// Bündelt Attribution + hält Rate-Limits zentral. Liefert vereinfachte Treffer.
export const runtime = "nodejs";

type Treffer = { label: string; name: string; lat: number; lng: number };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  // Reverse-Geocoding: Koordinaten -> Adresse (wenn kein Suchtext, aber lat/lon da)
  if (q.length < 3 && lat && lon) {
    try {
      const r = await fetch(
        `https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&lang=de`,
        { headers: { "User-Agent": "Kneipen-Golf/1.0 (https://www.kneipen-golf.de)" } }
      );
      if (!r.ok) return NextResponse.json({ ergebnisse: [] as Treffer[] });
      const data = await r.json();
      const f = (data.features ?? [])[0];
      if (!f) return NextResponse.json({ ergebnisse: [] as Treffer[] });
      const p = f.properties ?? {};
      const strasse = [p.street, p.housenumber].filter(Boolean).join(" ");
      const ort = [p.postcode, p.city].filter(Boolean).join(" ");
      const name = p.name || strasse || p.city || "Gewählter Ort";
      const label = [p.name, strasse, ort].filter(Boolean).join(", ") || name;
      return NextResponse.json({
        ergebnisse: [{ label, name, lat: Number(lat), lng: Number(lon) }] as Treffer[],
      });
    } catch {
      return NextResponse.json({ ergebnisse: [] as Treffer[] });
    }
  }

  if (q.length < 3) return NextResponse.json({ ergebnisse: [] as Treffer[] });

  const params = new URLSearchParams({ q, limit: "6", lang: "de" });
  // Optionaler Standort-Bias (z. B. Stadtzentrum), damit lokale Treffer zuerst kommen.
  if (lat && lon) {
    params.set("lat", lat);
    params.set("lon", lon);
  }

  try {
    const r = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { "User-Agent": "Kneipen-Golf/1.0 (https://www.kneipen-golf.de)" },
      // Ergebnisse dürfen kurz gecacht werden.
      next: { revalidate: 60 },
    });
    if (!r.ok) return NextResponse.json({ ergebnisse: [] as Treffer[] }, { status: 502 });
    const data = await r.json();

    const ergebnisse: Treffer[] = (data.features ?? [])
      .map((f: any): Treffer | null => {
        const p = f.properties ?? {};
        const coords = f.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const lng = Number(coords[0]);
        const la = Number(coords[1]);
        if (!isFinite(lng) || !isFinite(la)) return null;

        const strasse = [p.street, p.housenumber].filter(Boolean).join(" ");
        const ort = [p.postcode, p.city].filter(Boolean).join(" ");
        const name = p.name || strasse || p.city || "Ort";
        const label = [p.name, strasse, ort].filter(Boolean).join(", ") || name;
        return { label, name, lat: la, lng };
      })
      .filter((t: Treffer | null): t is Treffer => t !== null);

    return NextResponse.json({ ergebnisse });
  } catch {
    return NextResponse.json({ ergebnisse: [] as Treffer[] }, { status: 502 });
  }
}
