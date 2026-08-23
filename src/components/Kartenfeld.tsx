"use client";

/**
 * Rahmen um jede Karte in der App.
 *
 * Die Karte war bisher an jedem Einbauort anders eingefasst: auf der
 * Tour-Seite randlos bis an die Kanten, im Erstellen-Ablauf in einem
 * `h-64`-Kasten, bei geteilten Routen in einem `h-56`-Kasten. Drei Formate,
 * und keins davon hatte einen Übergang zwischen der hellen Kachelfläche und
 * dem dunkelgrünen Layout – die Karte lag im Bild, statt darin zu sitzen.
 *
 * Dieses Bauteil ist die eine Antwort darauf: gerundete Ecken, eine Linie,
 * und ein nach innen laufender Schatten, der die helle Fläche am Rand
 * abdunkelt. Der Schatten ist der eigentliche Trick – ohne ihn stößt Sand
 * hart gegen Flaschengrün.
 *
 * `hoehe` bleibt absichtlich frei: die Übersicht im Erstellen-Ablauf ist ein
 * Vorschaufeld, die Karte während des Spiels füllt den Rest der Seite.
 */
export function Kartenfeld({
  children,
  hoehe = "aspect-[4/3]",
  className = "",
}: {
  children: React.ReactNode;
  /** Tailwind-Klasse für die Höhe, z. B. `h-full` oder `aspect-[4/3]`. */
  hoehe?: string;
  className?: string;
}) {
  return (
    <div
      className={`kg-kartenfeld relative overflow-hidden rounded-2xl border border-[var(--linie)] ${hoehe} ${className}`}
    >
      {children}
    </div>
  );
}
