// Leichte, gerätelokale Einstellungen (localStorage). Bewusst simpel gehalten.

export type KartenStil = "dunkel" | "hell" | "farbig";

export const KARTEN_STILE: { id: KartenStil; label: string; url: string; sub: string }[] = [
  {
    id: "dunkel",
    label: "Dunkel",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    sub: "abcd",
  },
  {
    id: "hell",
    label: "Hell",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    sub: "abcd",
  },
  {
    id: "farbig",
    label: "Farbig",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    sub: "abcd",
  },
];

const KARTEN_KEY = "kg-karten-stil";
const MODUS_KEY = "kg-standard-modus";

export function getKartenStil(): KartenStil {
  if (typeof window === "undefined") return "dunkel";
  const v = localStorage.getItem(KARTEN_KEY);
  return v === "hell" || v === "farbig" ? v : "dunkel";
}

export function setKartenStil(v: KartenStil) {
  if (typeof window !== "undefined") localStorage.setItem(KARTEN_KEY, v);
}

/** Aktuelles Tile-Preset (URL + Subdomains) für die Karte. */
export function kartenTile(stil?: KartenStil) {
  const s = stil ?? getKartenStil();
  return KARTEN_STILE.find((k) => k.id === s) ?? KARTEN_STILE[0];
}

export function getStandardModus(): "einzel" | "team" {
  if (typeof window === "undefined") return "einzel";
  return localStorage.getItem(MODUS_KEY) === "team" ? "team" : "einzel";
}

export function setStandardModus(v: "einzel" | "team") {
  if (typeof window !== "undefined") localStorage.setItem(MODUS_KEY, v);
}
