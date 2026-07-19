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

/** Karten-Pin – Ort */
export function IconPin(p: IconProps) {
  return (
    <Basis {...p}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </Basis>
  );
}
