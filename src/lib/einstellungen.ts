// Leichte, gerätelokale Einstellungen (localStorage). Bewusst simpel gehalten.

export type KartenStil = "topo" | "dunkel" | "hell" | "farbig";

export type KartenPreset = {
  id: KartenStil;
  label: string;
  /** Ein Satz für die Einstellungen – was man bekommt, nicht wie es heißt. */
  hinweis: string;
  url: string;
  /** Subdomains. Leer lassen, wenn die URL kein `{s}` enthält. */
  sub?: string;
  /** Pflichtangabe des Anbieters. Steht unten rechts auf der Karte. */
  attribution: string;
  maxZoom: number;
  /**
   * Kacheln in doppelter Auflösung anfordern. Nur sinnvoll, wenn der Anbieter
   * das unterstützt – bei CARTO über `{r}` → `@2x`. Anbieter ohne diese
   * Variante liefern sonst einfach die nächste Zoomstufe, was mehr Kacheln
   * kostet, ohne schärfer zu sein.
   */
  retina?: boolean;
  /**
   * Flaschengrün-Filter über die Kacheln (siehe `.kg-karte-gruen` in
   * globals.css). Nur beim dunklen Stil sinnvoll – helle Karten werden
   * davon schlammig.
   */
  gruen?: boolean;
};

const OSM = '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const KARTEN_STILE: KartenPreset[] = [
  {
    // Warmer, sandfarbener Grundton – der einzige Stil, der von sich aus
    // Richtung Messing geht, statt sich per Filter dorthin biegen zu lassen.
    // Zu den Alternativen und ihren Lizenzen: claude/kartenstile-recherche.md
    id: "topo",
    label: "Topo",
    hinweis: "Warm und hell, gute Lesbarkeit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Kacheln &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, USGS, NPS, &copy; ' +
      OSM +
      "-Mitwirkende",
    maxZoom: 19,
    // Esri liefert für diesen Dienst keine @2x-Kacheln.
    retina: false,
  },
  {
    id: "dunkel",
    label: "Clubhouse",
    hinweis: "Dunkelgrün, für den späten Abend",
    gruen: true,
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    sub: "abcd",
    attribution: "&copy; " + OSM + ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    id: "hell",
    label: "Hell",
    hinweis: "Blasses Grau, sehr zurückhaltend",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    sub: "abcd",
    attribution: "&copy; " + OSM + ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    id: "farbig",
    label: "Farbig",
    hinweis: "Bunt, viel Detail",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    sub: "abcd",
    attribution: "&copy; " + OSM + ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
];

/** Was jemand sieht, der noch nie in den Einstellungen war. */
export const KARTEN_STANDARD: KartenStil = "topo";

const KARTEN_KEY = "kg-karten-stil";
const MODUS_KEY = "kg-standard-modus";

/** Kennt die App diesen Stil noch? Schützt vor Altwerten im localStorage. */
function istKartenStil(v: unknown): v is KartenStil {
  return KARTEN_STILE.some((k) => k.id === v);
}

export function getKartenStil(): KartenStil {
  if (typeof window === "undefined") return KARTEN_STANDARD;
  const v = localStorage.getItem(KARTEN_KEY);
  return istKartenStil(v) ? v : KARTEN_STANDARD;
}

export function setKartenStil(v: KartenStil) {
  if (typeof window !== "undefined") localStorage.setItem(KARTEN_KEY, v);
}

/** Aktuelles Kachel-Preset für die Karte. */
export function kartenTile(stil?: KartenStil): KartenPreset {
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
