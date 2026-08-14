import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ZUGANG_COOKIE,
  ZUGANG_COOKIE_OPTIONEN,
  ZUGANG_PARAM,
  erwarteterCode,
} from "@/lib/zugangscode";

export function middleware(req: NextRequest) {
  const token = req.cookies.get(ZUGANG_COOKIE)?.value;

  // Zugang bereits freigeschaltet -> durchlassen.
  if (token && token === erwarteterCode()) {
    return NextResponse.next();
  }

  // Einladungslink bringt den Zugang mit (…/tour/BONN-JJ6Q?z=…).
  // Cookie setzen und auf dieselbe URL ohne den Parameter umleiten – so
  // landet der Code weder in der Adresszeile noch im Browserverlauf.
  if (req.nextUrl.searchParams.get(ZUGANG_PARAM) === erwarteterCode()) {
    const sauber = req.nextUrl.clone();
    sauber.searchParams.delete(ZUGANG_PARAM);
    const res = NextResponse.redirect(sauber);
    res.cookies.set(ZUGANG_COOKIE, erwarteterCode(), ZUGANG_COOKIE_OPTIONEN);
    return res;
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
