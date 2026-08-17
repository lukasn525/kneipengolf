/**
 * Der Zugangscode der Seite – an genau einer Stelle definiert, damit
 * Middleware, Zugangs-API und Einladungslinks nicht auseinanderlaufen.
 * Über die Umgebungsvariable SITE_ACCESS_CODE überschreibbar.
 */
export function erwarteterCode(): string {
  // `||` statt `??` mit Absicht: `??` greift nur bei undefined, nicht bei "".
  // Eine in Vercel angelegte, aber leer gelassene Variable hätte den
  // erwarteten Code auf "" gesetzt – und damit die ganze Seite gesperrt.
  // Die Middleware lässt bei leerem Cookie niemanden durch, und über
  // /api/zugang wäre auch keine Eingabe mehr gültig gewesen: Aussperrung
  // für alle, ohne Fehlermeldung.
  return process.env.SITE_ACCESS_CODE || "casio2005";
}

/** Name des Cookies, das den bestandenen Zugang markiert. */
export const ZUGANG_COOKIE = "kg_zugang";

/** Query-Parameter, über den ein Einladungslink den Zugang mitbringt. */
export const ZUGANG_PARAM = "z";

/** Einheitliche Cookie-Optionen für Middleware und /api/zugang. */
export const ZUGANG_COOKIE_OPTIONEN = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 180, // ~180 Tage
} as const;
