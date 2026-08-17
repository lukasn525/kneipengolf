import { describe, expect, it } from "vitest";
import { distanzKm, erkenneStadt, normalisiere } from "@/lib/orte";
import type { Stadt } from "@/lib/types";

const bonn: Stadt = { id: 1, name: "Bonn", slug: "bonn", lat: 50.7344, lng: 7.0989, zoom: 14 };
const koeln: Stadt = { id: 2, name: "Köln", slug: "koeln", lat: 50.9375, lng: 6.9603, zoom: 14 };
const hamburg: Stadt = {
  id: 3,
  name: "Hamburg",
  slug: "hamburg",
  lat: 53.5511,
  lng: 9.9937,
  zoom: 14,
};
const STAEDTE = [bonn, koeln, hamburg];

describe("normalisiere", () => {
  it("schreibt Umlaute aus", () => {
    expect(normalisiere("Köln")).toBe("koeln");
    expect(normalisiere("Düsseldorf")).toBe("duesseldorf");
    expect(normalisiere("Straße")).toBe("strasse");
  });

  it("wirft Satzzeichen und Leerzeichen raus", () => {
    expect(normalisiere("Bad Godesberg")).toBe("badgodesberg");
    expect(normalisiere("Sankt-Augustin")).toBe("sanktaugustin");
  });

  it("macht Gross- und Kleinschreibung egal", () => {
    expect(normalisiere("BONN")).toBe(normalisiere("bonn"));
  });
});

describe("distanzKm", () => {
  it("ist null fuer denselben Punkt", () => {
    expect(distanzKm([50.7344, 7.0989], [50.7344, 7.0989])).toBe(0);
  });

  it("trifft die Luftlinie Bonn–Koeln auf wenige Kilometer", () => {
    // tatsaechlich rund 24 km
    const d = distanzKm([bonn.lat, bonn.lng], [koeln.lat, koeln.lng]);
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(28);
  });
});

describe("erkenneStadt", () => {
  it("erkennt den exakten Namen", () => {
    const t = erkenneStadt(STAEDTE, { ort: "Bonn", lat: 0, lng: 0 });
    expect(t).toEqual({ stadt: bonn, quelle: "name" });
  });

  it("erkennt den Namen trotz Umlaut-Schreibweise", () => {
    expect(erkenneStadt(STAEDTE, { ort: "Koeln", lat: 0, lng: 0 })?.stadt).toBe(koeln);
  });

  it("erkennt einen Stadtteil am enthaltenen Stadtnamen", () => {
    // "Köln-Ehrenfeld" enthaelt "Köln"
    const t = erkenneStadt(STAEDTE, { ort: "Köln-Ehrenfeld", lat: 0, lng: 0 });
    expect(t).toEqual({ stadt: koeln, quelle: "name" });
  });

  it("faellt auf die Naehe zurueck, wenn der Ortsname nichts hergibt", () => {
    // Bad Godesberg liegt rund 7 km von der Bonner Mitte entfernt
    const t = erkenneStadt(STAEDTE, { ort: "Bad Godesberg", lat: 50.6833, lng: 7.15 });
    expect(t).toEqual({ stadt: bonn, quelle: "naehe" });
  });

  it("waehlt bei Naehe die naechstgelegene Stadt", () => {
    // knapp noerdlich von Bonn, aber naeher an Bonn als an Koeln
    expect(erkenneStadt(STAEDTE, { lat: 50.78, lng: 7.05 })?.stadt).toBe(bonn);
  });

  it("ordnet lieber gar nichts zu als etwas Falsches", () => {
    // Mitten in Bayern – keine der Staedte ist im Radius.
    expect(erkenneStadt(STAEDTE, { ort: "Regensburg", lat: 49.0134, lng: 12.1016 })).toBeNull();
  });

  it("kommt ohne Staedteliste klar", () => {
    expect(erkenneStadt([], { ort: "Bonn", lat: 50.7344, lng: 7.0989 })).toBeNull();
  });

  it("kommt ohne Ortsnamen klar", () => {
    expect(erkenneStadt(STAEDTE, { ort: null, lat: 50.7344, lng: 7.0989 })?.stadt).toBe(bonn);
  });
});
