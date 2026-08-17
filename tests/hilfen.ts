/**
 * Bausteine für die Tests. Absichtlich winzig und ohne Magie: Ein Test soll
 * man lesen können, ohne erst diese Datei zu verstehen.
 */

import type { Ergebnis, Teilnehmer, Tour } from "@/lib/types";

/**
 * Standard-Tour: Par 3, Strafe aktiv, 1 Strafpunkt je Schluck über Par.
 * Das sind auch die Vorgaben, mit denen `/create` das Formular vorbelegt –
 * die Tests rechnen also mit dem, was tatsächlich meistens gespielt wird.
 */
export function tour(ueberschreiben: Partial<Tour> = {}): Tour {
  return {
    id: "tour-1",
    code: "BONN-TEST",
    name: "Testrunde",
    stadt_id: 1,
    host_user_id: "user-lukas",
    par_schwelle: 3,
    strafe_aktiv: true,
    strafe_pro_schluck: 1,
    verweigerung_strafe: 5,
    status: "laufend",
    glas_typ: "bier",
    spiel_modus: "einzel",
    erstellt_am: "2026-08-17T20:00:00Z",
    ...ueberschreiben,
  };
}

export function spieler(id: string, name = id): Teilnehmer {
  return {
    id,
    tour_id: "tour-1",
    name,
    user_id: `user-${id}`,
    erstellt_am: "2026-08-17T20:00:00Z",
  };
}

/** Gast: kein Konto, gehört einem verwaltenden Konto. */
export function gast(id: string, verwalter: string, name = id): Teilnehmer {
  return {
    id,
    tour_id: "tour-1",
    name,
    user_id: null,
    verwaltet_von: verwalter,
    erstellt_am: "2026-08-17T20:00:00Z",
  };
}

/** Eine erledigte Wertung. `strafschlucke` sind Zusatzschlucke, keine Punkte. */
export function wertung(
  teilnehmerId: string,
  stopId: string,
  schlucke: number,
  strafschlucke = 0
): Ergebnis {
  return {
    id: `${teilnehmerId}-${stopId}`,
    tour_id: "tour-1",
    tour_kneipe_id: stopId,
    teilnehmer_id: teilnehmerId,
    schlucke,
    strafschlucke,
    erledigt: true,
    erledigt_am: "2026-08-17T21:00:00Z",
  };
}

/** Angefangene, aber nicht abgeschlossene Wertung – zählt nirgends mit. */
export function offeneWertung(teilnehmerId: string, stopId: string, schlucke: number): Ergebnis {
  return { ...wertung(teilnehmerId, stopId, schlucke), erledigt: false, erledigt_am: null };
}

/** Die Route: Stop-IDs in der Reihenfolge, in der sie gespielt werden. */
export const ROUTE = ["stop-1", "stop-2", "stop-3"];
