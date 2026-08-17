import { describe, expect, it } from "vitest";
import {
  ALLE_TAGS,
  MAX_TAGS,
  TAG_GRUPPEN,
  barTags,
  istBekannt,
  passtZuTags,
  tagGruppe,
  tagLabel,
  tagStil,
  tagUmschalten,
  tagsFuerSpeichern,
} from "@/lib/tags";

describe("Vokabular", () => {
  it("hat keine doppelten Schluessel ueber alle Gruppen", () => {
    const keys = ALLE_TAGS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("benutzt nur kleingeschriebene Schluessel ohne Umlaute", () => {
    // Die Schluessel stehen so in der Datenbank und duerfen sich nie aendern.
    for (const t of ALLE_TAGS) expect(t.key).toMatch(/^[a-z_]+$/);
  });

  it("gibt jeder Gruppe eine Frage mit auf den Weg", () => {
    for (const g of TAG_GRUPPEN) expect(g.frage.length).toBeGreaterThan(0);
  });
});

describe("tagsFuerSpeichern", () => {
  it("laesst eine saubere Auswahl unveraendert", () => {
    expect(tagsFuerSpeichern(["kneipe", "gemuetlich"])).toEqual(["kneipe", "gemuetlich"]);
  });

  it("wirft Doppelte raus", () => {
    expect(tagsFuerSpeichern(["kneipe", "kneipe"])).toEqual(["kneipe"]);
  });

  it("wirft Unbekanntes raus, statt es zu speichern", () => {
    // Sonst wandern Tippfehler und alte Begriffe dauerhaft in die Datenbank.
    expect(tagsFuerSpeichern(["kneipe", "karte", "gibtsnicht"])).toEqual(["kneipe"]);
  });

  it("kappt bei MAX_TAGS", () => {
    const zuviele = ALLE_TAGS.slice(0, MAX_TAGS + 2).map((t) => t.key);
    expect(tagsFuerSpeichern(zuviele)).toHaveLength(MAX_TAGS);
  });

  it("kommt mit einer leeren Auswahl klar", () => {
    expect(tagsFuerSpeichern([])).toEqual([]);
  });

  it("haelt die Zusage der Datenbank ein: hoechstens drei, nichts Leeres", () => {
    // Spiegelt `bars_tags_max3` und `bars_tags_nicht_leer` aus 11_tags.sql.
    const raus = tagsFuerSpeichern(["", "kneipe", "bar", "club", "laut", ""]);
    expect(raus.length).toBeLessThanOrEqual(3);
    expect(raus).not.toContain("");
  });
});

describe("barTags", () => {
  it("liefert eine leere Liste statt zu werfen", () => {
    expect(barTags(null)).toEqual([]);
    expect(barTags(undefined)).toEqual([]);
    expect(barTags({})).toEqual([]);
    expect(barTags({ tags: null })).toEqual([]);
  });

  it("sortiert in Vokabular-Reihenfolge, nicht alphabetisch", () => {
    // 'kneipe' (Gruppe Art) steht vor 'gemuetlich' (Gruppe Stimmung),
    // obwohl es alphabetisch andersherum waere.
    expect(barTags({ tags: ["gemuetlich", "kneipe"] })).toEqual(["kneipe", "gemuetlich"]);
  });

  it("stellt unbekannte Tags hinten an, statt sie zu verschlucken", () => {
    // Ein aus dem Vokabular gestrichener Tag muss sichtbar bleiben.
    expect(barTags({ tags: ["altlast", "kneipe"] })).toEqual(["kneipe", "altlast"]);
  });

  it("entfernt Doppelte und Leeres", () => {
    expect(barTags({ tags: ["kneipe", "kneipe", "", "  "] })).toEqual(["kneipe"]);
  });
});

describe("unbekannte Tags brechen nichts", () => {
  it("zeigt den rohen Wert als Label", () => {
    expect(tagLabel("gibtsnicht")).toBe("gibtsnicht");
  });

  it("kennt keine Gruppe dafuer", () => {
    expect(tagGruppe("gibtsnicht")).toBeNull();
    expect(istBekannt("gibtsnicht")).toBe(false);
  });

  it("faellt auf einen gedaempften Stil zurueck", () => {
    expect(tagStil("gibtsnicht")).not.toBe(tagStil("kneipe"));
  });

  it("uebersetzt bekannte Tags weiterhin", () => {
    expect(tagLabel("kartenzahlung")).toBe("Kartenzahlung");
    expect(tagGruppe("kartenzahlung")).toBe("praktisch");
  });
});

describe("tagUmschalten", () => {
  it("nimmt einen Tag dazu", () => {
    expect(tagUmschalten([], "kneipe")).toEqual(["kneipe"]);
  });

  it("nimmt einen gesetzten Tag wieder weg", () => {
    expect(tagUmschalten(["kneipe", "laut"], "kneipe")).toEqual(["laut"]);
  });

  it("nimmt beim Maximum nichts mehr dazu", () => {
    const voll = ["kneipe", "laut", "guenstig"];
    expect(tagUmschalten(voll, "club")).toEqual(voll);
  });

  it("laesst beim Maximum aber noch abwaehlen", () => {
    const voll = ["kneipe", "laut", "guenstig"];
    expect(tagUmschalten(voll, "laut")).toEqual(["kneipe", "guenstig"]);
  });
});

describe("passtZuTags", () => {
  const bar = { tags: ["kneipe", "gemuetlich"] };

  it("laesst ohne Auswahl alles durch", () => {
    expect(passtZuTags(bar, [])).toBe(true);
    expect(passtZuTags({ tags: [] }, [])).toBe(true);
  });

  it("ist eine Ueberschneidung, keine Schnittmenge", () => {
    // Bei hoechstens drei Tags je Bar wuerde "alle muessen zutreffen"
    // fast immer nichts finden.
    expect(passtZuTags(bar, ["kneipe", "tanzen"])).toBe(true);
  });

  it("schliesst aus, was keinen der gewaehlten Tags traegt", () => {
    expect(passtZuTags(bar, ["tanzen"])).toBe(false);
  });

  it("laesst ungetaggte Bars bei aktivem Filter aussen vor", () => {
    expect(passtZuTags({ tags: [] }, ["kneipe"])).toBe(false);
    expect(passtZuTags({ tags: null }, ["kneipe"])).toBe(false);
  });
});
