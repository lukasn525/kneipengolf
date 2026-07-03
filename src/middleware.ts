import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Name des Cookies, das den bestandenen Zugang markiert.
const COOKIE = "kg_zugang";

// Der erwartete Zugangscode. Kann in Vercel über die Umgebungsvariable
// SITE_ACCESS_CODE überschrieben werden; sonst gilt der Standardwert.
function erwarteterCode() {
  return process.env.SITE_ACCESS_CODE ?? "casio2005";
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;

  // Zugang bereits freigeschaltet -> durchlassen.
  if (token && token === erwarteterCode()) {
    return NextResponse.next();
  }

  // Sonst auf die Zugangsseite umleiten und das ursprüngliche Ziel merken,
  // damit wir nach erfolgreicher Eingabe direkt dorthin springen können.
  const url = req.nextUrl.clone();
  url.pathname = "/zugang";
  url.search = "";
  url.searchParams.set("weiter", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Alles abfangen AUSSER: die Zugangsseite selbst, die Prüf-API,
  // Next-interne Assets und statische Dateien (alles mit einem Punkt im Pfad,
  // z. B. manifest.json, icon-192.png, sw.js, favicon.ico).
  matcher: ["/((?!zugang|api/zugang|_next/static|_next/image|.*\\..*).*)"],
};
