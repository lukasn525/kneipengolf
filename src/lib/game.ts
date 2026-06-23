import type { Ergebnis, Teilnehmer, Tour, TourKneipe } from "./types";

/** Zieht zufaellig eine Spielform-ID aus einer Liste. */
export function zieheSpielform(spielformIds: number[]): number {
  return spielformIds[Math.floor(Math.random() * spielformIds.length)];
}

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

/** Wie viele Stops sind ueber alle Teilnehmer hinweg erledigt vs. moeglich. */
export function fortschritt(
  teilnehmer: Teilnehmer[],
  kneipen: TourKneipe[],
  ergebnisse: Ergebnis[]
): { erledigt: number; gesamt: number } {
  const gesamt = teilnehmer.length * kneipen.length;
  const erledigt = ergebnisse.filter((e) => e.erledigt).length;
  return { erledigt, gesamt };
}

/** Erzeugt einen lesbaren Tour-Code, z.B. "KOELN-7F3K". */
export function tourCode(praefix: string): string {
  const zufall = Math.random().toString(36).slice(2, 6).toUpperCase();
  const p = (praefix || "TOUR").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "TOUR";
  return `${p}-${zufall}`;
}
