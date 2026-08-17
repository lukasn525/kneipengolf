import { describe, expect, it } from "vitest";
import { handicapText, handicapWert, rangliste, scoreEintrag, stopsText, tourCode } from "@/lib/game";
import { ROUTE, gast, offeneWertung, spieler, tour, wertung } from "./hilfen";

/** Kurzzugriff auf die Zeile eines Spielers. */
const zeile = (zeilen: ReturnType<typeof rangliste>, id: string) =>
  zeilen.find((z) => z.teilnehmer.id === id)!;

describe("scoreEintrag", () => {
  it("bleibt straffrei bis einschliesslich Par", () => {
    expect(scoreEintrag(wertung("a", "stop-1", 3), tour())).toEqual({ roh: 3, straf: 0, gesamt: 3 });
  });

  it("bestraft jeden Schluck ueber Par", () => {
    // 5 Schlucke, Par 3 -> 2 daruber -> 2 Strafpunkte -> gesamt 7
    expect(scoreEintrag(wertung("a", "stop-1", 5), tour())).toEqual({ roh: 5, straf: 2, gesamt: 7 });
  });

  it("rechnet Strafschlucke in den Rohwert ein und kann dadurch Strafe ausloesen", () => {
    // 2 getrunken + 2 Strafschlucke = 4 roh, also 1 ueber Par
    expect(scoreEintrag(wertung("a", "stop-1", 2, 2), tour())).toEqual({
      roh: 4,
      straf: 1,
      gesamt: 5,
    });
  });

  it("verdoppelt die Strafe bei strafe_pro_schluck = 2", () => {
    const t = tour({ strafe_pro_schluck: 2 });
    expect(scoreEintrag(wertung("a", "stop-1", 5), t).gesamt).toBe(5 + 2 * 2);
  });

  it("laesst bei abgeschalteter Strafe nur die Schlucke zaehlen", () => {
    const t = tour({ strafe_aktiv: false });
    expect(scoreEintrag(wertung("a", "stop-1", 9), t)).toEqual({ roh: 9, straf: 0, gesamt: 9 });
  });
});

describe("rangliste – Nachruecken", () => {
  /*
   * Der Fehler vom 16.08.2026, live in Produktion:
   *
   * Die Nachrueck-Regel griff auch fuer Stops, die eine Person noch gar nicht
   * erreicht hatte. Der Live-Score sprang nach oben, sobald jemand anderes ein
   * Loch weiter war, und fiel wieder, wenn man aufschloss.
   *
   * Genau dieser Fall steht hier als Erstes: ein Fehler, der einmal live war,
   * ist der wertvollste Testfall, den es gibt.
   */
  it("rueckt NICHT nach fuer Stops, die noch vor einem liegen", () => {
    const anna = spieler("anna");
    const ben = spieler("ben");
    const zeilen = rangliste(
      [anna, ben],
      [
        wertung("anna", "stop-1", 3), // Anna ist noch an Stop 1
        wertung("ben", "stop-1", 3),
        wertung("ben", "stop-2", 5), // Ben ist schon weiter
      ],
      tour({ status: "laufend" }),
      ROUTE
    );

    // Anna hat 3 – nicht 3 + Bens 7. Sie kommt an Stop 2 ja noch hin.
    expect(zeile(zeilen, "anna").nachgeruecktStops).toBe(0);
    expect(zeile(zeilen, "anna").gesamt).toBe(3);
  });

  it("rueckt nach fuer einen uebersprungenen Stop, an dem man vorbei ist", () => {
    const anna = spieler("anna");
    const ben = spieler("ben");
    const zeilen = rangliste(
      [anna, ben],
      [
        wertung("anna", "stop-1", 3),
        wertung("anna", "stop-3", 3), // Anna hat Stop 2 ausgelassen
        wertung("ben", "stop-2", 5), // dort gab es 7 Punkte
      ],
      tour({ status: "laufend" }),
      ROUTE
    );

    expect(zeile(zeilen, "anna").nachgeruecktStops).toBe(1);
    expect(zeile(zeilen, "anna").nachgerueckt).toBe(7);
    expect(zeile(zeilen, "anna").gesamt).toBe(3 + 3 + 7);
  });

  it("erbt den SCHLECHTESTEN Wert eines Stops, nicht den Durchschnitt", () => {
    const anna = spieler("anna");
    const zeilen = rangliste(
      [anna, spieler("ben"), spieler("carl")],
      [
        wertung("anna", "stop-1", 3),
        wertung("anna", "stop-3", 3),
        wertung("ben", "stop-2", 5), // gesamt 7  <- der schlechteste
        wertung("carl", "stop-2", 2), // gesamt 2
      ],
      tour({ status: "laufend" }),
      ROUTE
    );

    expect(zeile(zeilen, "anna").nachgerueckt).toBe(7);
  });

  it("rueckt bei beendeter Tour fuer alle fehlenden Stops nach", () => {
    const anna = spieler("anna");
    const zeilen = rangliste(
      [anna, spieler("ben")],
      [
        wertung("anna", "stop-1", 3),
        wertung("ben", "stop-1", 3),
        wertung("ben", "stop-2", 5), // gesamt 7
        wertung("ben", "stop-3", 4), // gesamt 5
      ],
      tour({ status: "beendet" }),
      ROUTE
    );

    // Am Ende zaehlt alles Fehlende – sonst gewaenne, wer frueh aufhoert.
    expect(zeile(zeilen, "anna").nachgeruecktStops).toBe(2);
    expect(zeile(zeilen, "anna").gesamt).toBe(3 + 7 + 5);
  });

  it("rueckt ohne Reihenfolge waehrend des Spiels gar nicht nach", () => {
    const zeilen = rangliste(
      [spieler("anna"), spieler("ben")],
      [wertung("anna", "stop-1", 3), wertung("ben", "stop-1", 3), wertung("ben", "stop-2", 5)],
      tour({ status: "laufend" })
      // kein `reihenfolge`-Argument
    );
    expect(zeile(zeilen, "anna").nachgeruecktStops).toBe(0);
  });

  it("laesst den Endstand von der fehlenden Reihenfolge unberuehrt", () => {
    const ergebnisse = [
      wertung("anna", "stop-1", 3),
      wertung("ben", "stop-1", 3),
      wertung("ben", "stop-2", 5),
    ];
    const mit = rangliste([spieler("anna")], ergebnisse, tour({ status: "beendet" }), ROUTE);
    const ohne = rangliste([spieler("anna")], ergebnisse, tour({ status: "beendet" }));
    expect(ohne[0].gesamt).toBe(mit[0].gesamt);
  });

  it("laesst Stops aus, an denen noch niemand gewertet hat", () => {
    const zeilen = rangliste(
      [spieler("anna"), spieler("ben")],
      [wertung("anna", "stop-1", 3), wertung("ben", "stop-1", 5)],
      tour({ status: "beendet" }),
      ROUTE
    );
    // stop-2 und stop-3 hat niemand gespielt -> zaehlen bei niemandem
    expect(zeile(zeilen, "anna").nachgeruecktStops).toBe(0);
    expect(zeile(zeilen, "ben").nachgeruecktStops).toBe(0);
  });

  it("ignoriert angefangene, aber nicht abgeschlossene Wertungen", () => {
    const zeilen = rangliste(
      [spieler("anna")],
      [wertung("anna", "stop-1", 3), offeneWertung("anna", "stop-2", 99)],
      tour(),
      ROUTE
    );
    expect(zeile(zeilen, "anna").erledigt).toBe(1);
    expect(zeile(zeilen, "anna").gesamt).toBe(3);
  });
});

describe("rangliste – Reihenfolge und Zaehlung", () => {
  it("sortiert den niedrigsten Gesamtwert nach vorn (Golf)", () => {
    const zeilen = rangliste(
      [spieler("anna"), spieler("ben")],
      [wertung("anna", "stop-1", 7), wertung("ben", "stop-1", 2)],
      tour(),
      ROUTE
    );
    expect(zeilen.map((z) => z.teilnehmer.id)).toEqual(["ben", "anna"]);
  });

  it("stellt bei Gleichstand den nach vorn, der mehr Stops selbst gespielt hat", () => {
    // Anna: zweimal 2 (je gesamt 2) = 4 aus zwei eigenen Stops.
    // Ben:  einmal 4 (gesamt 5) ... zu ungenau; deshalb glatt konstruiert:
    const zeilen = rangliste(
      [spieler("anna"), spieler("ben")],
      [
        wertung("anna", "stop-1", 2),
        wertung("anna", "stop-2", 2),
        wertung("ben", "stop-1", 2),
        wertung("ben", "stop-2", 2),
        wertung("ben", "stop-3", 0),
      ],
      tour(),
      ROUTE
    );
    // Beide 4 Punkte aus stop-1/2, Ben hat zusaetzlich stop-3 mit 0 gespielt.
    expect(zeile(zeilen, "ben").gesamt).toBe(zeile(zeilen, "anna").gesamt);
    expect(zeilen[0].teilnehmer.id).toBe("ben"); // mehr selbst gespielt
  });

  it("zaehlt Schlucke und Strafpunkte getrennt aus", () => {
    const zeilen = rangliste(
      [spieler("anna")],
      [wertung("anna", "stop-1", 5, 1)], // roh 6 -> 3 ueber Par
      tour(),
      ROUTE
    );
    const z = zeile(zeilen, "anna");
    expect(z.schlucke).toBe(5); // nur echte Schlucke
    expect(z.strafpunkte).toBe(3 + 1); // Par-Strafe + Strafschlucke
  });

  it("fuehrt Gaeste wie alle anderen", () => {
    const zeilen = rangliste(
      [spieler("anna"), gast("tom", "user-anna", "Tom")],
      [wertung("anna", "stop-1", 5), wertung("tom", "stop-1", 2)],
      tour(),
      ROUTE
    );
    expect(zeilen[0].teilnehmer.name).toBe("Tom");
  });

  it("gibt fuer jeden Teilnehmer eine Zeile aus, auch ohne Wertung", () => {
    const zeilen = rangliste([spieler("anna"), spieler("ben")], [], tour(), ROUTE);
    expect(zeilen).toHaveLength(2);
    expect(zeilen.every((z) => z.gesamt === 0 && z.erledigt === 0)).toBe(true);
  });
});

describe("handicapWert", () => {
  const par = { "tour-1": 3, "tour-2": 4 };

  it("liefert null, solange nichts abgeschlossen ist", () => {
    expect(handicapWert([], par)).toEqual({ wert: null, stops: 0 });
    expect(handicapWert([{ schlucke: 9, erledigt: false, tour_id: "tour-1" }], par)).toEqual({
      wert: null,
      stops: 0,
    });
  });

  it("mittelt die Abweichung von Par ueber alle erledigten Stops", () => {
    const r = handicapWert(
      [
        { schlucke: 5, erledigt: true, tour_id: "tour-1" }, // +2
        { schlucke: 1, erledigt: true, tour_id: "tour-1" }, // -2
      ],
      par
    );
    expect(r).toEqual({ wert: 0, stops: 2 });
  });

  it("wird negativ, wer im Schnitt unter Par bleibt", () => {
    expect(handicapWert([{ schlucke: 1, erledigt: true, tour_id: "tour-1" }], par).wert).toBe(-2);
  });

  it("rechnet je Tour mit deren eigenem Par", () => {
    const r = handicapWert(
      [
        { schlucke: 3, erledigt: true, tour_id: "tour-1" }, // Par 3 -> 0
        { schlucke: 3, erledigt: true, tour_id: "tour-2" }, // Par 4 -> -1
      ],
      par
    );
    expect(r.wert).toBe(-0.5);
  });

  it("rundet auf eine Nachkommastelle", () => {
    const r = handicapWert(
      [
        { schlucke: 4, erledigt: true, tour_id: "tour-1" },
        { schlucke: 4, erledigt: true, tour_id: "tour-1" },
        { schlucke: 3, erledigt: true, tour_id: "tour-1" },
      ],
      par
    );
    expect(r.wert).toBe(0.7); // 2/3 = 0.666…
  });

  it("nimmt Par 0 an, wenn die Tour nicht in der Par-Tabelle steht", () => {
    expect(handicapWert([{ schlucke: 4, erledigt: true, tour_id: "unbekannt" }], par).wert).toBe(4);
  });
});

describe("handicapText", () => {
  it("zeigt einen Gedankenstrich, wenn es noch keinen Wert gibt", () => {
    expect(handicapText(null)).toBe("–");
  });

  it("schreibt ein Plus ueber Par", () => {
    expect(handicapText(1.5)).toBe("+1.5");
  });

  it("benutzt ein echtes Minuszeichen, keinen Bindestrich", () => {
    // U+2212 MINUS SIGN – bei einer so grossen Zahl im Profil sieht man
    // den Unterschied zum Trennstrich sofort.
    expect(handicapText(-2)).toBe("−2");
    expect(handicapText(-2)).not.toBe("-2");
  });

  it("zeigt die Null ohne Vorzeichen", () => {
    expect(handicapText(0)).toBe("0");
  });
});

describe("stopsText", () => {
  it("benutzt den Singular bei genau einem Stop", () => {
    expect(stopsText(1)).toBe("1 Stop");
  });

  it("benutzt sonst den Plural", () => {
    expect(stopsText(0)).toBe("0 Stops");
    expect(stopsText(4)).toBe("4 Stops");
  });
});

describe("tourCode", () => {
  it("baut PRAEFIX-XXXX aus vier Zeichen Zufall", () => {
    expect(tourCode("Bonn")).toMatch(/^BONN-[A-Z0-9]{4}$/);
  });

  it("wirft alles raus, was kein Buchstabe ist – auch Umlaute", () => {
    // Deshalb heisst der Duesseldorfer Code in der Datenbank "DSSELD-…"
    expect(tourCode("Düsseldorf").split("-")[0]).toBe("DSSELD");
  });

  it("kuerzt den Praefix auf sechs Zeichen", () => {
    expect(tourCode("Frankfurt").split("-")[0]).toBe("FRANKF");
  });

  it("faellt auf TOUR zurueck, wenn nichts Brauchbares uebrig bleibt", () => {
    expect(tourCode("").split("-")[0]).toBe("TOUR");
    expect(tourCode("123 !!").split("-")[0]).toBe("TOUR");
  });
});
