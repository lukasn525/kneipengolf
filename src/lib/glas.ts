import type { GlasTyp } from "./types";

export const GLAESER: { typ: GlasTyp; label: string }[] = [
  { typ: "bier", label: "Bier" },
  { typ: "wein", label: "Wein" },
  { typ: "sekt", label: "Sekt" },
  { typ: "cocktail", label: "Cocktail" },
];

/** Comic-Glas, gezeichnet in einer 24×24-Box (nur Inhalt, ohne <svg>-Hülle). */
export function glasInnerSvg(typ: GlasTyp): string {
  switch (typ) {
    case "wein":
      return `
        <path d="M7.5 4 H16.5 C16.5 10.5 14 12.5 12 12.5 C10 12.5 7.5 10.5 7.5 4 Z" fill="#ffffff" stroke="#2a1d0a" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M8.7 6.6 H15.3 C14.9 9.8 13.2 11.2 12 11.2 C10.8 11.2 9.1 9.8 8.7 6.6 Z" fill="#9b1b3a"/>
        <line x1="12" y1="12.5" x2="12" y2="18.4" stroke="#2a1d0a" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="8.8" y1="19.2" x2="15.2" y2="19.2" stroke="#2a1d0a" stroke-width="1.7" stroke-linecap="round"/>`;
    case "sekt":
      return `
        <path d="M10 3.5 H14 L13.3 12.8 H10.7 Z" fill="#fbeeb0" stroke="#2a1d0a" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="12" cy="6" r="0.7" fill="#ffffff"/>
        <circle cx="11.3" cy="8.4" r="0.6" fill="#ffffff"/>
        <circle cx="12.6" cy="9.9" r="0.6" fill="#ffffff"/>
        <line x1="12" y1="12.8" x2="12" y2="18.6" stroke="#2a1d0a" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="9.2" y1="19.3" x2="14.8" y2="19.3" stroke="#2a1d0a" stroke-width="1.7" stroke-linecap="round"/>`;
    case "cocktail":
      return `
        <path d="M6 4.5 H18 L12 12 Z" fill="#ffffff" stroke="#2a1d0a" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M8.2 6 H15.8 L12 10.4 Z" fill="#ff5d8f"/>
        <line x1="14.5" y1="3.5" x2="11" y2="8.8" stroke="#2a1d0a" stroke-width="1"/>
        <circle cx="11" cy="8.9" r="1.5" fill="#6b8f5e" stroke="#2a1d0a" stroke-width="1"/>
        <line x1="12" y1="12" x2="12" y2="18.6" stroke="#2a1d0a" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="9" y1="19.3" x2="15" y2="19.3" stroke="#2a1d0a" stroke-width="1.7" stroke-linecap="round"/>`;
    case "bier":
    default:
      return `
        <ellipse cx="11" cy="7.4" rx="6.2" ry="3.1" fill="#fff7e6" stroke="#2a1d0a" stroke-width="1.4"/>
        <circle cx="7.6" cy="5.8" r="1.7" fill="#fff7e6" stroke="#2a1d0a" stroke-width="1.1"/>
        <circle cx="13.6" cy="5.2" r="1.9" fill="#fff7e6" stroke="#2a1d0a" stroke-width="1.1"/>
        <path d="M5.6 8 H16.4 V17.8 a2 2 0 0 1 -2 2 H7.6 a2 2 0 0 1 -2 -2 Z" fill="#f3a712" stroke="#2a1d0a" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M16.4 10 h2.4 a2.4 2.4 0 0 1 2.4 2.4 v0.8 a2.4 2.4 0 0 1 -2.4 2.4 h-2.4" fill="none" stroke="#2a1d0a" stroke-width="1.4"/>
        <line x1="6.8" y1="11.2" x2="15.2" y2="11.2" stroke="#fff7e6" stroke-width="1"/>`;
  }
}
