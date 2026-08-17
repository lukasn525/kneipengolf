"use client";

import { useRouter } from "next/navigation";
import { IconZurueck } from "./Icons";

/**
 * Kopfzeile für Seiten eine Ebene unter der Hauptnavigation.
 *
 * Diese Seiten (Spiel erstellen, Route bearbeiten, Einstellungen, geteilte
 * Route) haben bewusst keine Navigationsleiste unten – es sind Abläufe, keine
 * Bereiche. Dafür brauchen sie einen sichtbaren Weg zurück: bisher war das
 * nur das Logo oben links, und das liest sich wie ein Logo, nicht wie ein
 * Zurück-Knopf.
 *
 * Der Pfeil geht einen echten Schritt zurück, wenn es einen gibt. Wer über
 * einen geteilten Link direkt hier gelandet ist, hat keine Historie – dann
 * greift `zurueckZu` als verlässliches Ziel, statt aus der App zu fallen.
 */
export function SeitenKopf({
  titel,
  zurueckZu = "/dashboard",
  zurueckLabel = "Zurück",
  onZurueck,
  aktion,
}: {
  titel: string;
  zurueckZu?: string;
  zurueckLabel?: string;
  /** Eigene Rücksprung-Logik, z. B. einen Schritt statt eine Seite zurück. */
  onZurueck?: () => void;
  aktion?: React.ReactNode;
}) {
  const router = useRouter();

  function zurueck() {
    if (onZurueck) {
      onZurueck();
      return;
    }
    const hatHistorie =
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin);
    if (hatHistorie) router.back();
    else router.push(zurueckZu);
  }

  /*
   * Der Hintergrund läuft über ein Pseudo-Element auf volle Fensterbreite.
   * Ohne das endet die klebende Leiste auf breiten Bildschirmen an der
   * Inhaltskante, und darunter scrollt der Inhalt sichtbar vorbei.
   */
  return (
    <header
      className="sticky top-0 z-[900] -mx-4 flex items-center gap-1 border-b border-[var(--linie)] px-4 py-2
                 before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen
                 before:-translate-x-1/2 before:bg-nacht/95 before:backdrop-blur before:content-['']"
    >
      <button
        onClick={zurueck}
        className="-ml-2 flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-2 text-schaum/70 transition hover:text-schaum"
        aria-label={zurueckLabel}
      >
        <IconZurueck size={20} />
        <span className="text-sm">{zurueckLabel}</span>
      </button>
      <h1 className="min-w-0 flex-1 truncate pl-1 font-display text-lg">{titel}</h1>
      {aktion && (
        <div className="flex min-h-[44px] shrink-0 items-center justify-end">{aktion}</div>
      )}
    </header>
  );
}
