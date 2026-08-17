import { describe, expect, it } from "vitest";
import {
  beliebtheitText,
  leereBeliebtheit,
  nachBeliebtheit,
  punkte,
  stufe,
  type Beliebtheit,
} from "@/lib/beliebtheit";

function wert(u: Partial<Beliebtheit> = {}): Beliebtheit {
  return {
    bar_id: "bar-1",
    empfehlungen: 0,
    touren: 0,
    gruppen: 0,
    routen: 0,
    uebernahmen: 0,
    punkte: 0,
    ...u,
  };
}

describe("stufe", () => {
  it("gibt einer neuen Bar kein Abzeichen", () => {
    // Ein Abzeichen "0 Punkte" waere eine Bestrafung fuers Neusein.
    expect(stufe(undefined).rang).toBe(0);
    expect(stufe(wert({ punkte: 0 })).rang).toBe(0);
  });

  it("laesst ein einzelnes Spiel einer Gruppe noch keine Marke ergeben", () => {
    // 3 Punkte = ein Abend einer Gruppe. Sonst truege nach dem ersten
    // Abend alles ein Abzeichen und die Auszeichnung waere wertlos.
    expect(stufe(wert({ punkte: 3 })).rang).toBe(0);
  });

  it("trifft die Schwellen genau", () => {
    expect(stufe(wert({ punkte: 4 })).rang).toBe(0);
    expect(stufe(wert({ punkte: 5 })).label).toBe("gefragt");
    expect(stufe(wert({ punkte: 9 })).rang).toBe(1);
    expect(stufe(wert({ punkte: 10 })).label).toBe("beliebt");
    expect(stufe(wert({ punkte: 24 })).rang).toBe(2);
    expect(stufe(wert({ punkte: 25 })).label).toBe("Klassiker");
  });
});

describe("punkte", () => {
  it("behandelt eine unbekannte Bar als null", () => {
    expect(punkte(undefined)).toBe(0);
  });
});

describe("beliebtheitText", () => {
  it("schweigt bei einer Bar ohne Zuspruch", () => {
    expect(beliebtheitText(undefined)).toBeNull();
    expect(beliebtheitText(wert({ punkte: 0 }))).toBeNull();
  });

  it("nennt nur, was tatsaechlich vorkommt", () => {
    const t = beliebtheitText(wert({ punkte: 12, empfehlungen: 3, gruppen: 2, routen: 0 }));
    expect(t).toBe("3× empfohlen · 2 Gruppen");
    expect(t).not.toContain("Route");
  });

  it("beugt Gruppe und Route im Singular", () => {
    expect(beliebtheitText(wert({ punkte: 6, gruppen: 1, routen: 1 }))).toBe(
      "1 Gruppe · in 1 Route"
    );
  });

  it("liefert null, wenn Punkte da sind, aber keine der genannten Quellen", () => {
    // z. B. nur Uebernahmen – dann steht lieber die Adresse in der Zeile.
    expect(beliebtheitText(wert({ punkte: 4, uebernahmen: 2 }))).toBeNull();
  });
});

describe("nachBeliebtheit", () => {
  const bars = [
    { id: "c", name: "Cafe" },
    { id: "a", name: "Anker" },
    { id: "b", name: "Blaue Stunde" },
  ];

  it("sortiert die beliebteste nach vorn", () => {
    const werte = leereBeliebtheit();
    werte.set("b", wert({ bar_id: "b", punkte: 20 }));
    expect(nachBeliebtheit(bars, werte).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("sortiert bei Gleichstand alphabetisch nach deutscher Sortierung", () => {
    expect(nachBeliebtheit(bars, leereBeliebtheit()).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("laesst die uebergebene Liste unangetastet", () => {
    const kopie = [...bars];
    nachBeliebtheit(bars, leereBeliebtheit());
    expect(bars).toEqual(kopie);
  });
});
