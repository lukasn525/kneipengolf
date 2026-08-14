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
  /** Punkte aus nachgerückten Stops (nicht selbst gespielt). */
  nachgerueckt: number;
  /** Anzahl der Stops, die nachgerückt gewertet wurden. */
  nachgeruecktStops: number;
  gesamt: number;
};

/**
 * Baut die sortierte Rangliste (niedrigster Gesamtwert zuerst).
 *
 * Nachzügler-Regel: Stops, die andere schon gewertet haben, dieser Teilnehmer
 * aber nicht, zählen mit dem schlechtesten Wert, den an diesem Stop jemand
 * kassiert hat – man erbt also die Punkte des Letzten. Ohne das gewönne, wer
 * spät dazukommt, automatisch: fehlende Stops wären 0 Punkte, und beim Golf
 * gewinnt der niedrigste Wert.
 *
 * Stops, an denen noch niemand gewertet hat (die Gruppe ist schlicht noch
 * nicht dort), bleiben bei allen außen vor – die Live-Rangliste vergleicht
 * damit immer nur den bereits gespielten Teil des Abends.
 */
export function rangliste(
  teilnehmer: Teilnehmer[],
  ergebnisse: Ergebnis[],
  tour: Tour
): RanglistenZeile[] {
  const erledigte = ergebnisse.filter((e) => e.erledigt);

  // Pro Stop den schlechtesten (hoechsten) Gesamtwert merken – das ist die
  // Ersatzwertung fuer alle, die diesen Stop nicht selbst gespielt haben.
  const schlechtesterProStop = new Map<string, number>();
  for (const e of erledigte) {
    const { gesamt } = scoreEintrag(e, tour);
    const bisher = schlechtesterProStop.get(e.tour_kneipe_id);
    if (bisher === undefined || gesamt > bisher) {
      schlechtesterProStop.set(e.tour_kneipe_id, gesamt);
    }
  }

  const zeilen: RanglistenZeile[] = teilnehmer.map((t) => {
    const eigene = erledigte.filter((e) => e.teilnehmer_id === t.id);
    const eigeneStops = new Set(eigene.map((e) => e.tour_kneipe_id));
    let schlucke = 0;
    let strafpunkte = 0;
    let gesamt = 0;
    for (const e of eigene) {
      const s = scoreEintrag(e, tour);
      schlucke += e.schlucke || 0;
      strafpunkte += s.straf + (e.strafschlucke || 0);
      gesamt += s.gesamt;
    }

    let nachgerueckt = 0;
    let nachgeruecktStops = 0;
    for (const [stopId, wert] of schlechtesterProStop) {
      if (eigeneStops.has(stopId)) continue;
      nachgerueckt += wert;
      nachgeruecktStops += 1;
    }

    return {
      teilnehmer: t,
      erledigt: eigene.length,
      schlucke,
      strafpunkte,
      nachgerueckt,
      nachgeruecktStops,
      gesamt: gesamt + nachgerueckt,
    };
  });

  zeilen.sort((a, b) => {
    if (a.gesamt !== b.gesamt) return a.gesamt - b.gesamt;
    return b.erledigt - a.erledigt; // bei Gleichstand: mehr selbst gespielte Stops zuerst
  });
  return zeilen;
}

/**
 * Golf-Handicap eines Nutzers: durchschnittliche Schlücke über Par pro
 * erledigtem Stop, gemittelt über alle (auch tour-übergreifend) übergebenen
 * Ergebnisse. Niedriger ist besser; negativ = im Schnitt unter Par.
 *
 * Bewusst nur selbst gespielte Stops – nachgerückte Wertungen aus der
 * Rangliste sollen das persönliche Handicap nicht verfälschen.
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
