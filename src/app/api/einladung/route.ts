import { NextResponse } from "next/server";
import { erwarteterCode } from "@/lib/zugangscode";

/**
 * Liefert den Zugangscode für Einladungslinks.
 *
 * Die Route liegt selbst hinter der Middleware – nur wer den Zugang schon
 * hat, bekommt hier etwas. Damit kann die Lobby einen Link bauen, der die
 * Zugangshürde für Eingeladene überspringt (…/tour/CODE?z=…), statt sie auf
 * eine Passwortabfrage zu schicken, die in der Einladung gar nicht steht.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { z: erwarteterCode() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
