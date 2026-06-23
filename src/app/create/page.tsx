"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import { tourCode, zieheSpielform } from "@/lib/game";
import { GlasIcon } from "@/components/GlasIcon";
import { GLAESER } from "@/lib/glas";
import type { GlasTyp, KneipenVorlage, Spielform, Stadt } from "@/lib/types";

type Stop = { name: string; lat: number; lng: number; adresse: string | null };

function CreateInner() {
  const router = useRouter();
  const { user } = useSession();

  const [staedte, setStaedte] = useState<Stadt[]>([]);
  const [spielformen, setSpielformen] = useState<Spielform[]>([]);
  const [stadtId, setStadtId] = useState<number | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [name, setName] = useState("");
  const [par, setPar] = useState(3);
  const [strafeAktiv, setStrafeAktiv] = useState(true);
  const [strafeProSchluck, setStrafeProSchluck] = useState(1);
  const [verweigerung, setVerweigerung] = useState(5);
  const [glas, setGlas] = useState<GlasTyp>("bier");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // eigene Kneipe
  const [neuName, setNeuName] = useState("");
  const [neuAdresse, setNeuAdresse] = useState("");

  const stadt = useMemo(() => staedte.find((s) => s.id === stadtId) ?? null, [staedte, stadtId]);

  useEffect(() => {
    const sb = supabase();
    sb.from("staedte").select("*").order("name").then(({ data }) => setStaedte((data as Stadt[]) ?? []));
    sb.from("spielformen").select("*").then(({ data }) => setSpielformen((data as Spielform[]) ?? []));
  }, []);

  async function stadtWaehlen(id: number) {
    setStadtId(id);
    const { data } = await supabase()
      .from("kneipen_vorlage")
      .select("*")
      .eq("stadt_id", id)
      .order("sortierung");
    const vs = (data as KneipenVorlage[]) ?? [];
    setStops(vs.map((v) => ({ name: v.name, lat: v.lat, lng: v.lng, adresse: v.adresse })));
  }

  function move(i: number, dir: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function entfernen(i: number) {
    setStops((prev) => prev.filter((_, k) => k !== i));
  }
  function eigeneHinzufuegen() {
    if (!neuName.trim() || !stadt) return;
    // Position nahe dem Stadtzentrum (leichter Zufallsversatz, spaeter anpassbar)
    const off = () => (Math.random() - 0.5) * 0.01;
    setStops((prev) => [
      ...prev,
      {
        name: neuName.trim(),
        adresse: neuAdresse.trim() || null,
        lat: stadt.lat + off(),
        lng: stadt.lng + off(),
      },
    ]);
    setNeuName("");
    setNeuAdresse("");
  }

  async function erstellen() {
    if (!user || !stadt || stops.length === 0) return;
    setBusy(true);
    setFehler(null);
    const sb = supabase();
    try {
      const code = tourCode(stadt.name);
      const { data: tour, error: e1 } = await sb
        .from("touren")
        .insert({
          code,
          name: name.trim() || null,
          stadt_id: stadt.id,
          host_user_id: user.id,
          par_schwelle: par,
          strafe_aktiv: strafeAktiv,
          strafe_pro_schluck: strafeProSchluck,
          verweigerung_strafe: verweigerung,
          glas_typ: glas,
          status: "lobby",
        })
        .select()
        .single();
      if (e1 || !tour) throw e1 ?? new Error("Tour konnte nicht erstellt werden.");

      const rows = stops.map((s, i) => ({
        tour_id: tour.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        adresse: s.adresse,
        position: i,
      }));
      const { data: kneipen, error: e2 } = await sb.from("tour_kneipen").insert(rows).select();
      if (e2 || !kneipen) throw e2 ?? new Error("Kneipen konnten nicht gespeichert werden.");

      // Pro Kneipe einmalig eine Spielform ziehen (geteilt fuer alle)
      const ids = spielformen.map((s) => s.id);
      if (ids.length) {
        const ch = kneipen.map((k: any) => ({
          tour_id: tour.id,
          tour_kneipe_id: k.id,
          spielform_id: zieheSpielform(ids),
        }));
        await sb.from("kneipen_challenge").insert(ch);
      }

      router.push(`/tour/${code}`);
    } catch (err: any) {
      setFehler(err?.message ?? "Fehler beim Erstellen.");
      setBusy(false);
    }
  }

  return (
    <Shell>
      <TopBar />
      <div className="space-y-5 mt-2 pb-24">
        <h1 className="font-display text-2xl">Spiel erstellen</h1>

        <Card className="space-y-3">
          <Field label="Name des Spiels (optional)">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Geburtstags-Tour" />
          </Field>
          <Field label="Stadt">
            <div className="grid grid-cols-2 gap-2">
              {staedte.map((s) => (
                <button
                  key={s.id}
                  onClick={() => stadtWaehlen(s.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    stadtId === s.id
                      ? "border-bernstein bg-nacht-3"
                      : "border-[var(--linie)] bg-nacht-2 hover:bg-nacht-3"
                  }`}
                >
                  {s.name}
                </button>
              ))}
              {staedte.length === 0 && (
                <p className="text-sm text-schaum/50 col-span-2">
                  Keine Städte gefunden. Wurde das SQL-Schema in Supabase ausgeführt?
                </p>
              )}
            </div>
          </Field>
        </Card>

        {stadt && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Route ({stops.length} Stops)</h2>
            </div>
            <p className="text-sm text-schaum/60">
              Reihenfolge anpassen, Stops entfernen oder eigene Kneipen ergänzen.
            </p>
            <ul className="space-y-2">
              {stops.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-xl bg-nacht-3 border border-[var(--linie)] px-3 py-2"
                >
                  <span className="mono text-bernstein w-6 text-center">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{s.name}</span>
                    {s.adresse && <span className="block text-xs text-schaum/50 truncate">{s.adresse}</span>}
                  </span>
                  <button onClick={() => move(i, -1)} className="px-2 text-schaum/60 hover:text-schaum" aria-label="hoch">
                    ▲
                  </button>
                  <button onClick={() => move(i, 1)} className="px-2 text-schaum/60 hover:text-schaum" aria-label="runter">
                    ▼
                  </button>
                  <button onClick={() => entfernen(i)} className="px-2 text-ziegel hover:brightness-125" aria-label="entfernen">
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-dashed border-[var(--linie)] p-3 space-y-2">
              <span className="text-sm text-schaum/70">Eigene Kneipe hinzufügen</span>
              <Input value={neuName} onChange={(e) => setNeuName(e.target.value)} placeholder="Name" />
              <Input value={neuAdresse} onChange={(e) => setNeuAdresse(e.target.value)} placeholder="Adresse (optional)" />
              <Button variant="ghost" className="w-full" onClick={eigeneHinzufuegen} disabled={!neuName.trim()}>
                + Hinzufügen
              </Button>
              <p className="text-xs text-schaum/40">
                Eigene Stops landen am Stadtzentrum – die genaue Position lässt sich später auf der Karte feinjustieren.
              </p>
            </div>
          </Card>
        )}

        {stadt && (
          <Card className="space-y-3">
            <h2 className="font-display text-xl">Pin-Symbol</h2>
            <p className="text-sm text-schaum/60">Welches Glas markiert die Kneipen auf der Karte?</p>
            <div className="grid grid-cols-4 gap-2">
              {GLAESER.map((g) => (
                <button
                  key={g.typ}
                  onClick={() => setGlas(g.typ)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition ${
                    glas === g.typ
                      ? "border-bernstein bg-nacht-3"
                      : "border-[var(--linie)] bg-nacht-2 hover:bg-nacht-3"
                  }`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-schaum">
                    <GlasIcon typ={g.typ} size={30} />
                  </span>
                  <span className="text-xs text-schaum/80">{g.label}</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {stadt && (
          <Card className="space-y-4">
            <h2 className="font-display text-xl">Golf-Wertung</h2>
            <Field label={`Par-Schwelle: ${par} Schlücke`}>
              <input
                type="range"
                min={1}
                max={8}
                value={par}
                onChange={(e) => setPar(Number(e.target.value))}
                className="w-full accent-bernstein"
              />
            </Field>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={strafeAktiv}
                onChange={(e) => setStrafeAktiv(e.target.checked)}
                className="h-5 w-5 accent-bernstein"
              />
              <span className="text-sm">Strafpunkte über Par aktiv</span>
            </label>
            {strafeAktiv && (
              <Field label={`Strafpunkte pro Schluck über Par: ${strafeProSchluck}`}>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={strafeProSchluck}
                  onChange={(e) => setStrafeProSchluck(Number(e.target.value))}
                  className="w-full accent-bernstein"
                />
              </Field>
            )}
            <Field label={`Strafschlücke bei „nicht machbar“: ${verweigerung}`}>
              <input
                type="range"
                min={0}
                max={10}
                value={verweigerung}
                onChange={(e) => setVerweigerung(Number(e.target.value))}
                className="w-full accent-bernstein"
              />
            </Field>
          </Card>
        )}

        {fehler && <p className="text-sm text-ziegel">{fehler}</p>}
      </div>

      {stadt && stops.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[var(--linie)] bg-nacht/95 backdrop-blur p-4">
          <div className="mx-auto max-w-md">
            <Button className="w-full" onClick={erstellen} disabled={busy}>
              {busy ? "erstelle…" : "Spiel erstellen & Code generieren"}
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}

export default function CreatePage() {
  return (
    <Guard>
      <CreateInner />
    </Guard>
  );
}
