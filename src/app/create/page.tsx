"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import { tourCode, zieheSpielform } from "@/lib/game";
import { GlasIcon } from "@/components/GlasIcon";
import { GLAESER } from "@/lib/glas";
import { AdressSuche, type GeoTreffer } from "@/components/AdressSuche";
import { holeRoute, reverseGeocode } from "@/lib/nav";
import type { GlasTyp, KneipenVorlage, SpielModus, Spielform, Stadt } from "@/lib/types";

type Stop = { name: string; lat: number; lng: number; adresse: string | null };

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-schaum/40">Karte lädt…</div>
  ),
});

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
  const [spielModus, setSpielModus] = useState<SpielModus>("einzel");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const [eigenerModus, setEigenerModus] = useState(false);

  // Stop-Erstellung: Vorschau-Pin (per Kartentipp oder Suche), verschiebbar
  const [pending, setPending] = useState<
    { lat: number; lng: number; name: string; adresse: string | null } | null
  >(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  const stadt = useMemo(() => staedte.find((s) => s.id === stadtId) ?? null, [staedte, stadtId]);
  const aktiv = Boolean(stadt) || eigenerModus;
  const mapCenter = useMemo<[number, number]>(() => {
    if (stops.length) {
      const la = stops.reduce((a, s) => a + s.lat, 0) / stops.length;
      const ln = stops.reduce((a, s) => a + s.lng, 0) / stops.length;
      return [la, ln];
    }
    if (stadt) return [stadt.lat, stadt.lng];
    return [51.1657, 10.4515]; // Deutschland-Mitte als Fallback
  }, [stops, stadt]);

  useEffect(() => {
    const sb = supabase();
    sb.from("staedte").select("*").order("name").then(({ data }) => setStaedte((data as Stadt[]) ?? []));
    sb.from("spielformen").select("*").then(({ data }) => setSpielformen((data as Spielform[]) ?? []));
  }, []);

  // Straßenfolgende Route aktualisieren, wenn sich die Stops ändern
  useEffect(() => {
    if (stops.length < 2) {
      setRouteCoords([]);
      return;
    }
    let abbruch = false;
    const t = setTimeout(async () => {
      const r = await holeRoute(stops.map((s) => [s.lat, s.lng] as [number, number]));
      if (!abbruch) setRouteCoords(r?.coords ?? []);
    }, 400);
    return () => {
      abbruch = true;
      clearTimeout(t);
    };
  }, [stops]);

  async function stadtWaehlen(id: number) {
    setEigenerModus(false);
    setStadtId(id);
    const { data } = await supabase()
      .from("kneipen_vorlage")
      .select("*")
      .eq("stadt_id", id)
      .order("sortierung");
    const vs = (data as KneipenVorlage[]) ?? [];
    setStops(vs.map((v) => ({ name: v.name, lat: v.lat, lng: v.lng, adresse: v.adresse })));
  }

  function eigeneStadtWaehlen() {
    setEigenerModus(true);
    setStadtId(null);
    setStops([]);
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
  async function aufKarteTippen(lat: number, lng: number) {
    setPending({ lat, lng, name: "", adresse: null });
    setPendingBusy(true);
    const rev = await reverseGeocode(lat, lng);
    setPending((p) =>
      p ? { ...p, name: p.name || (rev?.name ?? ""), adresse: rev?.label ?? p.adresse } : p
    );
    setPendingBusy(false);
  }
  function ausSucheWaehlen(t: GeoTreffer) {
    setPending({ lat: t.lat, lng: t.lng, name: t.name, adresse: t.label });
    setFlyTo([t.lat, t.lng]);
  }
  async function pendingBewegt(lat: number, lng: number) {
    setPending((p) => (p ? { ...p, lat, lng } : p));
    setPendingBusy(true);
    const rev = await reverseGeocode(lat, lng);
    setPending((p) => (p ? { ...p, adresse: rev?.label ?? p.adresse } : p));
    setPendingBusy(false);
  }
  function pendingBestaetigen() {
    if (!pending || !pending.name.trim()) return;
    setStops((prev) => [
      ...prev,
      { name: pending.name.trim(), adresse: pending.adresse, lat: pending.lat, lng: pending.lng },
    ]);
    setPending(null);
  }
  function pendingVerwerfen() {
    setPending(null);
  }

  async function erstellen() {
    if (!user || stops.length === 0 || (!stadt && !eigenerModus)) return;
    setBusy(true);
    setFehler(null);
    const sb = supabase();
    try {
      const code = tourCode(stadt ? stadt.name : name || "TOUR");
      const { data: tour, error: e1 } = await sb
        .from("touren")
        .insert({
          code,
          name: name.trim() || null,
          stadt_id: stadt ? stadt.id : null,
          host_user_id: user.id,
          par_schwelle: par,
          strafe_aktiv: strafeAktiv,
          strafe_pro_schluck: strafeProSchluck,
          verweigerung_strafe: verweigerung,
          glas_typ: glas,
          spiel_modus: spielModus,
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
          <Field label="Modus">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-nacht-3 p-1">
              {(["einzel", "team"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSpielModus(m)}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    spielModus === m ? "bg-bernstein text-[#2a1d0a]" : "text-schaum/70"
                  }`}
                >
                  {m === "einzel" ? "Einzelspieler" : "Team"}
                </button>
              ))}
            </div>
          </Field>
          <p className="text-xs text-schaum/50">
            {spielModus === "team"
              ? "Team-Modus: Jedes Gerät spielt als ein Team (Pass-and-Play im Team), die Rangliste vergleicht Teams."
              : "Einzelspieler: jede Person wertet für sich."}
          </p>
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
              <button
                onClick={eigeneStadtWaehlen}
                className={`col-span-2 rounded-xl border px-4 py-3 text-left transition ${
                  eigenerModus
                    ? "border-bernstein bg-nacht-3"
                    : "border-dashed border-[var(--linie)] bg-nacht-2 hover:bg-nacht-3"
                }`}
              >
                ✏️ Eigene Stadt / Route
              </button>
            </div>
          </Field>
        </Card>

        {aktiv && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Route ({stops.length} Stops)</h2>
            </div>
            <p className="text-sm text-schaum/60">
              Tippe auf die Karte, um einen Stop zu setzen – oder such eine Adresse. Den Pin kannst
              du für die exakte Position verschieben.
            </p>

            <AdressSuche
              naehe={stadt ? [stadt.lat, stadt.lng] : null}
              placeholder="Adresse oder Kneipe suchen…"
              onWaehlen={ausSucheWaehlen}
            />

            <div className="relative h-72 overflow-hidden rounded-xl border border-[var(--linie)]">
              <Map
                stops={stops.map((s, i) => ({
                  id: String(i),
                  tour_id: "",
                  name: s.name,
                  lat: s.lat,
                  lng: s.lng,
                  adresse: s.adresse,
                  position: i,
                }))}
                erledigt={new Set<string>()}
                onPin={() => {}}
                center={mapCenter}
                zoom={stadt?.zoom ?? (stops.length ? 15 : 6)}
                glas={glas}
                routeCoords={routeCoords}
                route
                onMapClick={aufKarteTippen}
                pending={pending ? [pending.lat, pending.lng] : null}
                onPendingMove={pendingBewegt}
                flyTo={flyTo}
              />
              {pendingBusy && (
                <div className="absolute left-2 top-2 rounded-full bg-nacht/90 px-3 py-1 text-xs text-schaum/80">
                  Adresse wird gesucht…
                </div>
              )}
            </div>

            {pending && (
              <div className="space-y-2 rounded-xl border border-bernstein/50 bg-nacht-3 p-3">
                <span className="text-sm text-schaum/70">Neuen Stop hinzufügen</span>
                <Input
                  value={pending.name}
                  onChange={(e) => setPending((p) => (p ? { ...p, name: e.target.value } : p))}
                  placeholder="Name der Kneipe"
                />
                <p className="truncate text-xs text-schaum/50">
                  📍 {pending.adresse ?? "Position auf der Karte gewählt"}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={pendingBestaetigen} disabled={!pending.name.trim()}>
                    + Als Stop hinzufügen
                  </Button>
                  <Button variant="ghost" onClick={pendingVerwerfen}>
                    Verwerfen
                  </Button>
                </div>
              </div>
            )}

            {stops.length > 0 && (
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
                    <button onClick={() => move(i, -1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-schaum/70 hover:bg-nacht-2" aria-label="hoch">
                      ▲
                    </button>
                    <button onClick={() => move(i, 1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-schaum/70 hover:bg-nacht-2" aria-label="runter">
                      ▼
                    </button>
                    <button onClick={() => entfernen(i)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ziegel hover:bg-nacht-2" aria-label="entfernen">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {aktiv && (
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

        {aktiv && (
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

      {aktiv && stops.length > 0 && (
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
