"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";

export type GeoTreffer = { label: string; name: string; lat: number; lng: number };

/**
 * Adress-/Ortssuche mit Autocomplete. Ruft den serverseitigen Geocoder
 * (/api/geocode) mit Debounce ab und meldet den gewählten Treffer inkl.
 * echter Koordinaten zurück.
 */
export function AdressSuche({
  onWaehlen,
  naehe,
  placeholder,
}: {
  onWaehlen: (treffer: GeoTreffer) => void;
  /** Optionaler Standort-Bias, z. B. Stadtzentrum [lat, lng]. */
  naehe?: [number, number] | null;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<GeoTreffer[]>([]);
  const [offen, setOffen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [gewaehlt, setGewaehlt] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (gewaehlt) return; // nach Auswahl nicht sofort neu suchen
    const text = q.trim();
    if (text.length < 3) {
      setTreffer([]);
      setOffen(false);
      return;
    }
    setLaedt(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ q: text });
        if (naehe) {
          p.set("lat", String(naehe[0]));
          p.set("lon", String(naehe[1]));
        }
        const r = await fetch(`/api/geocode?${p.toString()}`);
        const d = await r.json();
        setTreffer((d.ergebnisse as GeoTreffer[]) ?? []);
        setOffen(true);
      } catch {
        setTreffer([]);
      } finally {
        setLaedt(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, naehe, gewaehlt]);

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => {
          setGewaehlt(false);
          setQ(e.target.value);
        }}
        onFocus={() => treffer.length > 0 && setOffen(true)}
        placeholder={placeholder ?? "Adresse oder Name suchen…"}
        autoComplete="off"
      />
      {laedt && (
        <span className="absolute right-3 top-3 text-xs text-schaum/40" aria-hidden>
          …
        </span>
      )}
      {offen && treffer.length > 0 && (
        <ul className="absolute z-[1200] mt-1 w-full overflow-hidden rounded-xl border border-[var(--linie)] bg-nacht-2 shadow-xl">
          {treffer.map((t, i) => (
            <li key={`${t.lat}-${t.lng}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onWaehlen(t);
                  setQ(t.label);
                  setGewaehlt(true);
                  setOffen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-nacht-3"
              >
                <span className="block truncate text-sm">{t.name}</span>
                <span className="block truncate text-xs text-schaum/50">{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
