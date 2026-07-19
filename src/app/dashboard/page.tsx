"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import { handicapWert } from "@/lib/game";
import { IconPapierkorb } from "@/components/Icons";
import type { Tour } from "@/lib/types";

function DashboardInner() {
  const router = useRouter();
  const { user } = useSession();
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meine, setMeine] = useState<Tour[]>([]);
  const [meineGeladen, setMeineGeladen] = useState(false);
  const [handicap, setHandicap] = useState<{ wert: number | null; stops: number } | null>(null);
  const [statistik, setStatistik] = useState<{ touren: number; bestwert: number | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase()
      .from("touren")
      .select("*")
      .eq("host_user_id", user.id)
      .order("erstellt_am", { ascending: false })
      .then(({ data }) => {
        setMeine((data as Tour[]) ?? []);
        setMeineGeladen(true);
      });
  }, [user]);

  // Handicap + Statistiken über alle Touren berechnen, an denen der Nutzer teilgenommen hat
  useEffect(() => {
    if (!user) return;
    (async () => {
      const sb = supabase();
      const { data: tn } = await sb.from("teilnehmer").select("id,tour_id").eq("user_id", user.id);
      const tnRows = (tn as { id: string; tour_id: string }[]) ?? [];
      if (!tnRows.length) {
        setHandicap({ wert: null, stops: 0 });
        setStatistik({ touren: 0, bestwert: null });
        return;
      }
      const { data: erg } = await sb
        .from("ergebnisse")
        .select("schlucke,strafschlucke,erledigt,tour_id,teilnehmer_id")
        .in("teilnehmer_id", tnRows.map((t) => t.id))
        .eq("erledigt", true);
      const ergRows =
        (erg as {
          schlucke: number;
          strafschlucke: number;
          erledigt: boolean;
          tour_id: string;
          teilnehmer_id: string;
        }[]) ?? [];
      const tourIds = Array.from(new Set(ergRows.map((e) => e.tour_id)));
      const parProTour: Record<string, number> = {};
      const tourInfo: Record<
        string,
        { par_schwelle: number; strafe_aktiv: boolean; strafe_pro_schluck: number; status: string }
      > = {};
      if (tourIds.length) {
        const { data: tr } = await sb
          .from("touren")
          .select("id,par_schwelle,strafe_aktiv,strafe_pro_schluck,status")
          .in("id", tourIds);
        for (const t of (tr as {
          id: string;
          par_schwelle: number;
          strafe_aktiv: boolean;
          strafe_pro_schluck: number;
          status: string;
        }[]) ?? []) {
          parProTour[t.id] = t.par_schwelle;
          tourInfo[t.id] = t;
        }
      }
      setHandicap(handicapWert(ergRows, parProTour));

      // Statistiken: Anzahl beendeter Touren + bester Gesamtwert (Golf: niedriger = besser)
      const beendete = tourIds.filter((id) => tourInfo[id]?.status === "beendet");
      let bestwert: number | null = null;
      for (const tourId of beendete) {
        const info = tourInfo[tourId];
        const gesamt = ergRows
          .filter((e) => e.tour_id === tourId)
          .reduce((sum, e) => {
            const roh = (e.schlucke || 0) + (e.strafschlucke || 0);
            const straf = info.strafe_aktiv
              ? Math.max(0, roh - info.par_schwelle) * info.strafe_pro_schluck
              : 0;
            return sum + roh + straf;
          }, 0);
        if (bestwert === null || gesamt < bestwert) bestwert = gesamt;
      }
      setStatistik({ touren: beendete.length, bestwert });
    })();
  }, [user]);

  async function loeschen(t: Tour) {
    if (!confirm(`Tour ${t.code} wirklich löschen? Alle Daten dieser Tour gehen verloren.`)) return;
    const { error } = await supabase().from("touren").delete().eq("id", t.id);
    if (error) {
      setFehler("Löschen fehlgeschlagen: " + error.message);
      return;
    }
    setMeine((prev) => prev.filter((x) => x.id !== t.id));
  }

  async function beitreten(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setBusy(true);
    const sauber = code.trim().toUpperCase();
    const { data, error } = await supabase()
      .from("touren")
      .select("code")
      .eq("code", sauber)
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      setFehler("Keine Tour mit diesem Code gefunden.");
      return;
    }
    router.push(`/tour/${sauber}`);
  }

  return (
    <Shell>
      <TopBar />
      <div className="space-y-5 mt-2">
        {meineGeladen && meine.length === 0 && (
          <Card className="space-y-3">
            <h2 className="font-display text-xl">So funktioniert Kneipen-Golf</h2>
            <ol className="space-y-2">
              {[
                ["1", "Route erstellen", "Stadt wählen oder eigene Route bauen – 9 Kneipen wie 9 Löcher."],
                ["2", "Freunde einladen", "Code oder QR teilen, alle treten mit ihrem Namen bei."],
                ["3", "Golf trinken", "Pro Kneipe eine Challenge, Schlücke zählen – der niedrigste Score gewinnt."],
              ].map(([n, titel, text]) => (
                <li key={n} className="flex gap-3">
                  <span className="mono grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bernstein/15 text-sm text-bernstein">
                    {n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{titel}</span>
                    <span className="block text-xs text-schaum/50">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {handicap && handicap.wert !== null && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-schaum/60">Dein Handicap</p>
                <p className="text-xs text-schaum/40">
                  {handicap.stops} gewertete Stops · niedriger ist besser
                </p>
              </div>
              <p className="mono text-3xl text-bernstein">
                {handicap.wert > 0 ? "+" : ""}
                {handicap.wert}
              </p>
            </div>
            {statistik && statistik.touren > 0 && (
              <div className="grid grid-cols-2 gap-2 border-t border-[var(--linie)] pt-3">
                <div className="rounded-xl bg-nacht-3 px-3 py-2">
                  <p className="text-xs text-schaum/50">Gespielte Touren</p>
                  <p className="mono text-xl">{statistik.touren}</p>
                </div>
                <div className="rounded-xl bg-nacht-3 px-3 py-2">
                  <p className="text-xs text-schaum/50">Bestwert</p>
                  <p className="mono text-xl">{statistik.bestwert ?? "–"}</p>
                </div>
              </div>
            )}
          </Card>
        )}

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Neues Spiel</h2>
          <p className="text-sm text-schaum/70">
            Stadt wählen, Kneipen-Route festlegen, Mitspieler einladen.
          </p>
          <Link href="/create">
            <Button className="w-full">Spiel erstellen</Button>
          </Link>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Mit Code beitreten</h2>
          <form onSubmit={beitreten} className="space-y-3">
            <Field label="Tour-Code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="z. B. KOELN-7F3K"
                className="mono uppercase"
              />
            </Field>
            {fehler && <p className="text-sm text-ziegel">{fehler}</p>}
            <Button variant="ghost" type="submit" className="w-full" disabled={busy || !code.trim()}>
              {busy ? "…" : "Beitreten"}
            </Button>
          </form>
        </Card>

        {meine.length > 0 && (
          <Card className="space-y-2">
            <h2 className="font-display text-xl">Deine Spiele</h2>
            <ul className="divide-y divide-[var(--linie)]">
              {meine.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <Link
                    href={`/tour/${t.code}`}
                    className="flex flex-1 items-center justify-between py-3 hover:text-bernstein"
                  >
                    <span>
                      <span className="mono text-bernstein">{t.code}</span>
                      {t.name ? <span className="text-schaum/60"> · {t.name}</span> : null}
                    </span>
                    <span className="text-xs text-schaum/50">{statusLabel(t.status)}</span>
                  </Link>
                  <button
                    onClick={() => loeschen(t)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ziegel hover:bg-nacht-3"
                    aria-label="Tour löschen"
                    title="Tour löschen"
                  >
                    <IconPapierkorb />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Shell>
  );
}

function statusLabel(s: Tour["status"]) {
  return s === "lobby" ? "Lobby" : s === "laufend" ? "läuft" : "beendet";
}

export default function DashboardPage() {
  return (
    <Guard>
      <DashboardInner />
    </Guard>
  );
}
