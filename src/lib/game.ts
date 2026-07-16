import type { Ergebnis, Teilnehmer, Tour } from "./types";

/** Golf-Score fuer einen einzelnen Ergebnis-Eintrag (eine Kneipe). */
export function scoreEintrag(e: Ergebnis, tour: Tour): { roh: number; straf: number; gesamt: number } {
  const roh = (e.schlucke || 0) + (e.strafschlucke || 0);
  let straf = 0;
  if (tour.strafe_aktiv) {
    straf = Math.max(0, roh - tour.par_schwelle) * tour.strafe_pro_schluck;
  }
  return { roh, straf, gesamt: roh + straf };
}

export type RanglistenZeile = {
  teilnehmer: Teilnehmer;
  erledigt: number;
  schlucke: number;
  strafpunkte: number;
  gesamt: number;
};

/** Baut die sortierte Rangliste (niedrigster Gesamtwert zuerst). */
export function rangliste(
  teilnehmer: Teilnehmer[],
  ergebnisse: Ergebnis[],
  tour: Tour
): RanglistenZeile[] {
  const zeilen: RanglistenZeile[] = teilnehmer.map((t) => {
    const eigene = ergebnisse.filter((e) => e.teilnehmer_id === t.id && e.erledigt);
    let schlucke = 0;
    let strafpunkte = 0;
    let gesamt = 0;
    for (const e of eigene) {
      const s = scoreEintrag(e, tour);
      schlucke += e.schlucke || 0;
      strafpunkte += s.straf + (e.strafschlucke || 0);
      gesamt += s.gesamt;
    }
    return { teilnehmer: t, erledigt: eigene.length, schlucke, strafpunkte, gesamt };
  });

  zeilen.sort((a, b) => {
    if (a.gesamt !== b.gesamt) return a.gesamt - b.gesamt;
    return b.erledigt - a.erledigt; // bei Gleichstand: mehr erledigte Stops zuerst
  });
  return zeilen;
}

/**
 * Golf-Handicap eines Nutzers: durchschnittliche Schlücke über Par pro
 * erledigtem Stop, gemittelt über alle (auch tour-übergreifend) übergebenen
 * Ergebnisse. Niedriger ist besser; negativ = im Schnitt unter Par.
 */
export function handicapWert(
  ergebnisse: { schlucke: number; erledigt: boolean; tour_id: string }[],
  parProTour: Record<string, number>
): { wert: number | null; stops: number } {
  const diffs: number[] = [];
  for (const e of ergebnisse) {
    if (!e.erledigt) continue;
    diffs.push((e.schlucke || 0) - (parProTour[e.tour_id] ?? 0));
  }
  if (!diffs.length) return { wert: null, stops: 0 };
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return { wert: Math.round(avg * 10) / 10, stops: diffs.length };
}

/** Erzeugt einen lesbaren Tour-Code, z.B. "KOELN-7F3K". */
export function tourCode(praefix: string): string {
  const zufall = Math.random().toString(36).slice(2, 6).toUpperCase();
  const p = (praefix || "TOUR").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "TOUR";
  return `${p}-${zufall}`;
}
