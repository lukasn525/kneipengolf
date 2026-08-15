"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { TopBar } from "@/components/TopBar";
import { BottomNav, BottomNavAbstand } from "@/components/BottomNav";
import { Button, Card, Shell } from "@/components/ui";
import { handicapText, handicapWert, rangliste, stopsText } from "@/lib/game";
import { IconPokal, IconProfil } from "@/components/Icons";
import type { Ergebnis, Teilnehmer, Tour } from "@/lib/types";

type VerlaufsEintrag = {
  tourId: string;
  code: string;
  name: string | null;
  datum: string | null;
  stops: number;
  gesamt: number;
  platz: number;
  von: number;
};

/**
 * Eigener Bereich für alles Persönliche.
 *
 * Handicap und Statistiken lagen bisher als eine Kachel zwischen den
 * Handlungs-Karten im „Spielen"-Tab und gingen dort unter. Der Verlauf ist
 * neu – die Daten dafür lagen längst in der Datenbank, es fehlte nur der Ort.
 */
function ProfilInner() {
  const { user } = useSession();
  const router = useRouter();

  const [handicap, setHandicap] = useState<{ wert: number | null; stops: number } | null>(null);
  const [verlauf, setVerlauf] = useState<VerlaufsEintrag[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const sb = supabase();
      const { data: tn } = await sb.from("teilnehmer").select("id,tour_id").eq("user_id", user.id);
      const meine = (tn as { id: string; tour_id: string }[]) ?? [];
      if (!meine.length) {
        setHandicap({ wert: null, stops: 0 });
        setVerlauf([]);
        return;
      }
      const tourIds = Array.from(new Set(meine.map((t) => t.tour_id)));
      const meineTnIds = new Set(meine.map((t) => t.id));

      // Alle Ergebnisse dieser Touren – auch die der Mitspieler, sonst lässt
      // sich die eigene Platzierung nicht bestimmen.
      const [{ data: erg }, { data: tr }, { data: alleTn }] = await Promise.all([
        sb.from("ergebnisse").select("*").in("tour_id", tourIds),
        sb.from("touren").select("*").in("id", tourIds),
        sb.from("teilnehmer").select("*").in("tour_id", tourIds),
      ]);
      const ergRows = (erg as Ergebnis[]) ?? [];
      const touren = (tr as Tour[]) ?? [];
      const tnRows = (alleTn as Teilnehmer[]) ?? [];

      const parProTour: Record<string, number> = {};
      for (const t of touren) parProTour[t.id] = t.par_schwelle;
      setHandicap(
        handicapWert(
          ergRows.filter((e) => meineTnIds.has(e.teilnehmer_id)),
          parProTour
        )
      );

      const eintraege: VerlaufsEintrag[] = [];
      for (const t of touren) {
        if (t.status !== "beendet") continue;
        const tnDerTour = tnRows.filter((x) => x.tour_id === t.id);
        const ergDerTour = ergRows.filter((x) => x.tour_id === t.id);
        const zeilen = rangliste(tnDerTour, ergDerTour, t);
        const i = zeilen.findIndex((z) => meineTnIds.has(z.teilnehmer.id));
        if (i < 0) continue;
        eintraege.push({
          tourId: t.id,
          code: t.code,
          name: t.name ?? null,
          datum: t.erstellt_am ?? null,
          stops: zeilen[i].erledigt,
          gesamt: zeilen[i].gesamt,
          platz: i + 1,
          von: zeilen.length,
        });
      }
      eintraege.sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
      setVerlauf(eintraege);
    })();
  }, [user]);

  const anzeigename =
    (user?.user_metadata?.display_name as string) || user?.email?.split("@")[0] || "Spieler:in";
  const bestwert = verlauf?.length ? Math.min(...verlauf.map((v) => v.gesamt)) : null;

  return (
    <Shell>
      <TopBar />

      <div className="mt-2 space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border border-[var(--linie)] text-bernstein">
            <IconProfil size={30} />
          </div>
          <h1 className="font-display text-2xl">{anzeigename}</h1>
          <p className="mt-1 text-xs text-schaum/60">{user?.email}</p>
        </div>

        {!handicap ? (
          <div className="kg-skeleton h-[132px] w-full" />
        ) : (
          <Card className="text-center">
            <p className="text-[10px] uppercase tracking-[.13em] text-bernstein">Handicap</p>
            <p className="mono my-2 text-4xl leading-tight text-bernstein">
              {handicapText(handicap.wert)}
            </p>
            <p className="text-xs text-schaum/60">
              {handicap.stops === 0
                ? "Noch keine gewerteten Stops"
                : `${stopsText(handicap.stops)} gewertet · niedriger ist besser`}
            </p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <p className="text-[10px] uppercase tracking-[.13em] text-schaum/60">Runden</p>
            <p className="mono mt-1 text-xl">{verlauf === null ? "–" : verlauf.length}</p>
          </Card>
          <Card className="text-center">
            <p className="text-[10px] uppercase tracking-[.13em] text-schaum/60">Bestwert</p>
            <p className="mono mt-1 text-xl">{bestwert ?? "–"}</p>
          </Card>
        </div>

        <Card className="space-y-2">
          <h2 className="font-display text-xl">Verlauf</h2>
          {verlauf === null ? (
            <div className="kg-skeleton h-16 w-full" />
          ) : verlauf.length === 0 ? (
            <p className="text-sm text-schaum/60">
              Noch keine beendete Runde. Sobald eine Tour ausgewertet ist, steht sie hier.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--linie)]">
              {verlauf.map((v) => (
                <li key={v.tourId}>
                  <button
                    onClick={() => router.push(`/tour/${v.code}`)}
                    className="flex w-full items-center gap-3 py-3 text-left hover:text-bernstein"
                  >
                    <IconPokal size={18} className="shrink-0 text-bernstein" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{v.name || v.code}</span>
                      <span className="block text-xs text-schaum/60">
                        {kurzesDatum(v.datum)} · {stopsText(v.stops)} · Platz {v.platz} von {v.von}
                      </span>
                    </span>
                    <span className="mono shrink-0 text-schaum/60">{v.gesamt}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Button variant="ghost" className="w-full" onClick={() => router.push("/einstellungen")}>
          Einstellungen
        </Button>
      </div>

      <BottomNavAbstand />
      <BottomNav />
    </Shell>
  );
}

function kurzesDatum(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function ProfilPage() {
  return (
    <Guard>
      <ProfilInner />
    </Guard>
  );
}
