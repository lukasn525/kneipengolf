/**
 * Der Zugangscode der Seite – an genau einer Stelle definiert, damit
 * Middleware, Zugangs-API und Einladungslinks nicht auseinanderlaufen.
 * Über die Umgebungsvariable SITE_ACCESS_CODE überschreibbar.
 */
export function erwarteterCode(): string {
  return process.env.SITE_ACCESS_CODE ?? "casio2005";
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
