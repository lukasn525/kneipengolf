"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { SeitenKopf } from "@/components/SeitenKopf";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import {
  KARTEN_STILE,
  getKartenStil,
  setKartenStil,
  getStandardModus,
  setStandardModus,
  type KartenStil,
} from "@/lib/einstellungen";

function EinstellungenInner() {
  const router = useRouter();
  const { user } = useSession();
  const [nick, setNick] = useState("");
  const [kartenStil, setStil] = useState<KartenStil>("dunkel");
  const [modus, setModus] = useState<"einzel" | "team">("einzel");
  const [busy, setBusy] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    setNick((user?.user_metadata?.display_name as string) || "");
    setStil(getKartenStil());
    setModus(getStandardModus());
  }, [user]);

  function zeige(text: string) {
    setHinweis(text);
    setTimeout(() => setHinweis(null), 2500);
  }

  async function nickSpeichern() {
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ data: { display_name: nick.trim() } });
    setBusy(false);
    zeige(error ? "Fehler: " + error.message : "Nickname gespeichert ✓");
  }

  function stilWaehlen(s: KartenStil) {
    setStil(s);
    setKartenStil(s);
    zeige("Kartenstil gespeichert ✓");
  }

  function modusWaehlen(m: "einzel" | "team") {
    setModus(m);
    setStandardModus(m);
    zeige("Standard gespeichert ✓");
  }

  async function abmelden() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  return (
    <Shell>
      <SeitenKopf titel="Einstellungen" zurueckZu="/profil" zurueckLabel="Profil" />
      <div className="mt-3 space-y-5 pb-10">

        <Card className="space-y-3">
          <Field label="Fester Nickname">
            <Input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Dein Anzeigename"
            />
          </Field>
          <p className="text-xs text-schaum/60">
            Wird im Einzelspieler-Modus automatisch als dein Name vorgeschlagen.
          </p>
          <Button onClick={nickSpeichern} disabled={busy || !nick.trim()} className="w-full">
            {busy ? "…" : "Nickname speichern"}
          </Button>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Kartenstil</h2>
          <div className="grid grid-cols-3 gap-2">
            {KARTEN_STILE.map((k) => (
              <button
                key={k.id}
                onClick={() => stilWaehlen(k.id)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  kartenStil === k.id
                    ? "border-bernstein bg-nacht-3"
                    : "border-[var(--linie)] bg-nacht-2 hover:bg-nacht-3"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-schaum/60">Gilt für alle Karten in der App.</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Standard beim Erstellen</h2>
          <Field label="Voreingestellter Spiel-Modus">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-nacht-3 p-1">
              {(["einzel", "team"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => modusWaehlen(m)}
                  className={`min-h-[44px] rounded-lg py-2 text-sm font-semibold transition ${
                    modus === m ? "bg-bernstein text-tinte" : "text-schaum/70"
                  }`}
                >
                  {m === "einzel" ? "Einzelspieler" : "Team"}
                </button>
              ))}
            </div>
          </Field>
        </Card>

        <Card className="space-y-2">
          <h2 className="font-display text-xl">Konto</h2>
          <p className="text-sm text-schaum/60">
            Angemeldet als <span className="text-schaum">{user?.email}</span>
          </p>
          <Button variant="ghost" className="w-full" onClick={abmelden}>
            Abmelden
          </Button>
        </Card>

        {hinweis && <p className="text-center text-sm text-moos">{hinweis}</p>}
      </div>
    </Shell>
  );
}

export default function EinstellungenPage() {
  return (
    <Guard>
      <EinstellungenInner />
    </Guard>
  );
}
