import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ZUGANG_COOKIE,
  ZUGANG_COOKIE_OPTIONEN,
  ZUGANG_PARAM,
  erwarteterCode,
} from "@/lib/zugangscode";

afterEach(() => vi.unstubAllEnvs());

describe("erwarteterCode", () => {
  it("nimmt den Wert aus der Umgebung, wenn einer gesetzt ist", () => {
    vi.stubEnv("SITE_ACCESS_CODE", "geheim");
    expect(erwarteterCode()).toBe("geheim");
  });

  it("hat einen Rueckfallwert, damit die App ohne Env nicht dichtmacht", () => {
    vi.stubEnv("SITE_ACCESS_CODE", "");
    expect(erwarteterCode().length).toBeGreaterThan(0);
  });
});

describe("Cookie-Vorgaben", () => {
  /*
   * Diese Konstanten sind der Grund, warum Middleware, /api/zugang und die
   * Einladungslinks nicht auseinanderlaufen. Sie sind ausserdem das, was ein
   * E2E-Test setzen muss, bevor er ueberhaupt eine Seite zu sehen bekommt.
   */
  it("bleibt beim vereinbarten Cookie-Namen und Parameter", () => {
    expect(ZUGANG_COOKIE).toBe("kg_zugang");
    expect(ZUGANG_PARAM).toBe("z");
  });

  it("haelt das Cookie vor JavaScript verborgen und auf der ganzen Seite gueltig", () => {
    expect(ZUGANG_COOKIE_OPTIONEN.httpOnly).toBe(true);
    expect(ZUGANG_COOKIE_OPTIONEN.path).toBe("/");
    expect(ZUGANG_COOKIE_OPTIONEN.sameSite).toBe("lax");
  });

  it("laesst das Cookie lange genug leben, dass niemand den Code zweimal tippt", () => {
    expect(ZUGANG_COOKIE_OPTIONEN.maxAge).toBeGreaterThan(60 * 60 * 24 * 90);
  });
});
