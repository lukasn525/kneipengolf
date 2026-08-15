"use client";

/**
 * Einheitliches SVG-Icon-Set (statt Emojis) für ein ruhigeres, wertigeres Bild.
 * Alle Icons erben die Textfarbe (currentColor) und skalieren über `size`.
 */

type IconProps = { size?: number; className?: string };

function Basis({
  size = 18,
  className = "",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Zahnrad – Einstellungen */
export function IconZahnrad(p: IconProps) {
  return (
    <Basis {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Basis>
  );
}

/** Papierkorb – Löschen */
export function IconPapierkorb(p: IconProps) {
  return (
    <Basis {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </Basis>
  );
}

/** Kompass – Navigieren */
export function IconKompass(p: IconProps) {
  return (
    <Basis {...p}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" stroke="none" />
    </Basis>
  );
}

/** Chevron hoch – Reihenfolge */
export function IconHoch(p: IconProps) {
  return (
    <Basis {...p}>
      <polyline points="18 15 12 9 6 15" />
    </Basis>
  );
}

/** Chevron runter – Reihenfolge */
export function IconRunter(p: IconProps) {
  return (
    <Basis {...p}>
      <polyline points="6 9 12 15 18 9" />
    </Basis>
  );
}

/** X – Schließen/Entfernen */
export function IconX(p: IconProps) {
  return (
    <Basis {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Basis>
  );
}

/** Haken – erledigt */
export function IconHaken(p: IconProps) {
  return (
    <Basis {...p}>
      <polyline points="20 6 9 17 4 12" />
    </Basis>
  );
}

/** Stift – Eigenes/Bearbeiten */
export function IconStift(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Basis>
  );
}

/** Auge – sichtbar */
export function IconAuge(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Basis>
  );
}

/** Auge durchgestrichen – ausgeblendet */
export function IconAugeAus(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Basis>
  );
}

/** Globus – öffentlich */
export function IconGlobus(p: IconProps) {
  return (
    <Basis {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Basis>
  );
}

/** Schloss – privat */
export function IconSchloss(p: IconProps) {
  return (
    <Basis {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Basis>
  );
}

/** Plus – hinzufügen */
export function IconPlus(p: IconProps) {
  return (
    <Basis {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Basis>
  );
}

/** Pfeil nach rechts – weiter */
export function IconWeiter(p: IconProps) {
  return (
    <Basis {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Basis>
  );
}

/** Warndreieck – Meldung/Moderation */
export function IconWarnung(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Basis>
  );
}

/** Karten-Pin – Ort */
export function IconPin(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </Basis>
  );
}

/** Flamme – Beliebtheit einer Bar */
export function IconFlamme(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M12 2c1.5 3.5-1 5-2.5 6.5C8 10 7 11.5 7 13.5a5 5 0 0 0 10 0c0-2.5-1.5-4-2.5-5.5" />
      <path d="M12 21a2.5 2.5 0 0 0 2.5-2.5c0-1.5-1.3-2.3-2.5-4-1.2 1.7-2.5 2.5-2.5 4A2.5 2.5 0 0 0 12 21z" />
    </Basis>
  );
}

/** Geschlängelter Weg mit Stationen – Route */
export function IconRoute(p: IconProps) {
  return (
    <Basis {...p}>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19h5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7h5" />
    </Basis>
  );
}

/** Verbundene Knoten – teilen */
export function IconTeilen(p: IconProps) {
  return (
    <Basis {...p}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
    </Basis>
  );
}

/** Zwei Blätter – Link kopieren */
export function IconKopieren(p: IconProps) {
  return (
    <Basis {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Basis>
  );
}

/**
 * Pfeil in eine Ablage – „übernommen".
 * Markiert Bars und Routen, die aus einem geteilten Link stammen.
 */
export function IconUebernommen(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Basis>
  );
}

/* ── Navigationssymbole (Lucide-Formen, gleiche Strichstärke) ──────── */

/** Aufgeklappte Landkarte – „Spielen". */
export function IconKarte(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" />
      <path d="M9 3.236v15" />
    </Basis>
  );
}

/** Bücherstapel – „Sammlung" (Bars und Spiele). */
export function IconSammlung(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </Basis>
  );
}

/** Person – „Profil". */
export function IconProfil(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Basis>
  );
}

/** Pokal – Verlauf und Auswertung. */
export function IconPokal(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Basis>
  );
}

/** Pfeil nach links – zurück eine Ebene höher. */
export function IconZurueck(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Basis>
  );
}

/** Fahne am Mast – Markenzeichen statt Bierkrug-Emoji. */
export function IconFlagge(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </Basis>
  );
}
