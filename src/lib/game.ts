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
  tour: Tour,
  /**
   * Stop-IDs in Routenreihenfolge. Ohne diese Angabe greift die
   * Nachrück-Wertung nur bei beendeten Touren – siehe unten.
   */
  reihenfolge?: string[]
): RanglistenZeile[] {
  const erledigte = ergebnisse.filter((e) => e.erledigt);
  const beendet = tour.status === "beendet";
  const platzImWeg = new Map(reihenfolge?.map((id, i) => [id, i]) ?? []);

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

    /*
     * Nachrücken darf NUR für Stops gelten, die diese Person nicht mehr
     * spielen wird – nicht für solche, die sie schlicht noch nicht erreicht
     * hat. Sonst springt der Live-Score nach oben, sobald jemand anderes ein
     * Loch vor einem beendet, und fällt wieder, wenn man aufschließt.
     *
     * „Nicht mehr spielbar" heißt: die Tour ist vorbei – oder die Person ist
     * in der Route schon an diesem Stop vorbei (sie hat einen späteren
     * gewertet). Fehlt die Reihenfolge, wird während des Spiels nichts
     * nachgerückt; der Endstand bleibt davon unberührt.
     */
    const weitesterEigener = eigene.reduce((max, e) => {
      const i = platzImWeg.get(e.tour_kneipe_id);
      return i !== undefined && i > max ? i : max;
    }, -1);

    let nachgerueckt = 0;
    let nachgeruecktStops = 0;
    for (const [stopId, wert] of schlechtesterProStop) {
      if (eigeneStops.has(stopId)) continue;
      const i = platzImWeg.get(stopId);
      const schonVorbei = i !== undefined && i < weitesterEigener;
      if (!beendet && !schonVorbei) continue;
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

/**
 * Handicap als Text: echtes Minuszeichen (−, U+2212) statt Bindestrich und
 * ein ausgeschriebenes Plus über Par. Bei einer Zahl, die so groß im Profil
 * steht, sieht man den Unterschied zum Trennstrich sofort.
 */
export function handicapText(wert: number | null): string {
  if (wert === null) return "–";
  if (wert > 0) return `+${wert}`;
  if (wert < 0) return `\u2212${Math.abs(wert)}`;
  return "0";
}

/** „1 Stop" statt „1 Stops". */
export function stopsText(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? "Stop" : "Stops"}`;
}

/** Erzeugt einen lesbaren Tour-Code, z.B. "KOELN-7F3K". */
export function tourCode(praefix: string): string {
  const zufall = Math.random().toString(36).slice(2, 6).toUpperCase();
  const p = (praefix || "TOUR").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "TOUR";
  return `${p}-${zufall}`;
}
