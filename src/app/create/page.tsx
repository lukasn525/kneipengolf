"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import { tourCode } from "@/lib/game";
import { GlasIcon } from "@/components/GlasIcon";
import { GLAESER } from "@/lib/glas";
import { AdressSuche, type GeoTreffer } from "@/components/AdressSuche";
import { holeRoute, reverseGeocode } from "@/lib/nav";
import { getStandardModus } from "@/lib/einstellungen";
import type { GlasTyp, KneipenVorlage, SpielModus, Spielform, Stadt } from "@/lib/types";

type Stop = { name: string; lat: number; lng: number; adresse: string | null; vorlageId?: number };

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
  const routeReqId = useRef(0); // stellt sicher, dass nur die neueste Route greift
  const eigeneIdRef = useRef(0); // eindeutige (negative) IDs für selbst gesetzte Kneipen

  // Kneipen-Auswahl
  const [vorlagen, setVorlagen] = useState<KneipenVorlage[]>([]);
  const [pickerOffen, setPickerOffen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"liste" | "selbst">("liste");
  const [erweitertOffen, setErweitertOffen] = useState(false);

  // Spielformen: an-/abwählbar + eigene
  const [spielformAuswahl, setSpielformAuswahl] = useState<
    { id: number; titel: string; beschreibung: string; aktiv: boolean; eigen: boolean }[]
  >([]);
  const [sfTitel, setSfTitel] = useState("");
  const [sfBesch, setSfBesch] = useState("");
  const [sfFormOffen, setSfFormOffen] = useState(false);
  const eigeneSpielformIdRef = useRef(0);

  const stadt = useMemo(() => staedte.find((s) => s.id === stadtId) ?? null, [staedte, stadtId]);
  const aktiv = Boolean(stadt) || eigenerModus;
  const verfuegbareVorlagen = vorlagen.filter((v) => !stops.some((s) => s.vorlageId === v.id));
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
    sb.from("spielformen").select("*").then(({ data }) => {
      const sf = (data as Spielform[]) ?? [];
      setSpielformAuswahl(
        sf.map((s) => ({
          id: s.id,
          titel: s.titel,
          beschreibung: s.beschreibung,
          aktiv: true,
          eigen: false,
        }))
      );
    });
    setSpielModus(getStandardModus()); // Voreinstellung aus den Einstellungen
  }, []);

  // Route neu berechnen, sobald sich die Stops ändern.
  // Die gezeichnete Linie muss immer zur aktuellen Reihenfolge passen:
  // - solide Route sofort verwerfen (in der Zwischenzeit zeigt die Karte die
  //   gestrichelte Verbindung in korrekter Reihenfolge, nie eine veraltete Route)
  // - nur die jeweils neueste Antwort anwenden (keine Races bei schnellem Add/Delete)
  useEffect(() => {
    setRouteCoords([]);
    if (stops.length < 2) return;
    const reqId = ++routeReqId.current;
    const t = setTimeout(async () => {
      const r = await holeRoute(stops.map((s) => [s.lat, s.lng] as [number, number]));
      if (reqId === routeReqId.current) setRouteCoords(r?.coords ?? []);
    }, 350);
    return () => clearTimeout(t);
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
    setVorlagen(vs);
    // Standardmäßig 9 Kneipen laden (wie 9 Golf-Löcher)
    setStops(
      vs.slice(0, 9).map((v) => ({
        vorlageId: v.id,
        name: v.name,
        lat: v.lat,
        lng: v.lng,
        adresse: v.adresse,
      }))
    );
  }

  function eigeneStadtWaehlen() {
    setEigenerModus(true);
    setStadtId(null);
    setStops([]);
    setVorlagen([]);
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
    // Selbst gesetzte Kneipe bekommt eine eigene (negative) ID und landet auch
    // im Auswahl-Pool -> danach unter "Aus Liste" wieder auswählbar.
    const id = --eigeneIdRef.current;
    const eigene: KneipenVorlage = {
      id,
      stadt_id: stadt?.id ?? 0,
      name: pending.name.trim(),
      lat: pending.lat,
      lng: pending.lng,
      adresse: pending.adresse,
      sortierung: 0,
    };
    setVorlagen((prev) => [...prev, eigene]);
    setStops((prev) => [
      ...prev,
      { vorlageId: id, name: eigene.name, lat: eigene.lat, lng: eigene.lng, adresse: eigene.adresse },
    ]);
    setPending(null);
  }
  function pendingVerwerfen() {
    setPending(null);
  }

  function vorlageHinzufuegen(v: KneipenVorlage) {
    setStops((prev) => [
      ...prev,
      { vorlageId: v.id, name: v.name, lat: v.lat, lng: v.lng, adresse: v.adresse },
    ]);
  }
  function openPicker() {
    setPending(null);
    setPickerTab(eigenerModus || verfuegbareVorlagen.length === 0 ? "selbst" : "liste");
    setPickerOffen(true);
  }

  function toggleSpielform(id: number) {
    setSpielformAuswahl((prev) => prev.map((s) => (s.id === id ? { ...s, aktiv: !s.aktiv } : s)));
  }
  function eigeneSpielformHinzufuegen() {
    if (!sfTitel.trim()) return;
    const id = --eigeneSpielformIdRef.current;
    setSpielformAuswahl((prev) => [
      ...prev,
      { id, titel: sfTitel.trim(), beschreibung: sfBesch.trim(), aktiv: true, eigen: true },
    ]);
    setSfTitel("");
    setSfBesch("");
    setSfFormOffen(false);
  }
  function eigeneSpielformEntfernen(id: number) {
    setSpielformAuswahl((prev) => prev.filter((s) => s.id !== id));
  }

  async function erstellen() {
    if (!user || stops.length === 0 || (!stadt && !eigenerModus)) return;
    const aktiveSpielformen = spielformAuswahl.filter((s) => s.aktiv);
    if (aktiveSpielformen.length === 0) {
      setFehler("Mindestens eine Spielform muss aktiv sein.");
      return;
    }
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

      // Pro Kneipe einmalig eine aktive Spielform ziehen und als Snapshot speichern
      // (Titel + Beschreibung), damit auch eigene Spielformen funktionieren.
      const ch = kneipen.map((k: any) => {
        const s = aktiveSpielformen[Math.floor(Math.random() * aktiveSpielformen.length)];
        return {
          tour_id: tour.id,
          tour_kneipe_id: k.id,
          spielform_id: s.eigen ? null : s.id,
          titel: s.titel,
          beschreibung: s.beschreibung,
        };
      });
      await sb.from("kneipen_challenge").insert(ch);

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
              Standardmäßig sind 9 Kneipen geladen. Reihenfolge anpassen, entfernen – oder über „Kneipe
              hinzufügen" ergänzen.
            </p>

            {stops.length > 0 && (
              <div className="h-64 overflow-hidden rounded-xl border border-[var(--linie)]">
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
                />
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

            <Button variant="ghost" className="w-full" onClick={openPicker}>
              + Kneipe hinzufügen
            </Button>
          </Card>
        )}

        {aktiv && (
          <Card className="space-y-3">
            <button
              type="button"
              onClick={() => setErweitertOffen((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-display text-xl">Erweiterte Einstellungen</span>
              <span className="text-sm text-schaum/50">{erweitertOffen ? "▲ zu" : "▼ auf"}</span>
            </button>

            {!erweitertOffen ? (
              <p className="text-xs text-schaum/50">
                Par {par} · {strafeAktiv ? "Strafpunkte an" : "Strafpunkte aus"} ·{" "}
                {spielformAuswahl.filter((s) => s.aktiv).length} Spielformen · Pin:{" "}
                {GLAESER.find((g) => g.typ === glas)?.label}
              </p>
            ) : (
              <div className="space-y-6 pt-1">
                <div className="space-y-2">
                  <h3 className="font-display text-lg">Pin-Symbol</h3>
                  <p className="text-sm text-schaum/60">
                    Welches Glas markiert die Kneipen auf der Karte?
                  </p>
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
                </div>

                <div className="space-y-4">
                  <h3 className="font-display text-lg">Golf-Wertung</h3>
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
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg">Spielformen</h3>
                    <span className="text-xs text-schaum/50">
                      {spielformAuswahl.filter((s) => s.aktiv).length} aktiv
                    </span>
                  </div>
                  <p className="text-sm text-schaum/60">
                    Tippe an, um Spielformen ins Spiel zu nehmen oder rauszunehmen.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {spielformAuswahl.map((s) =>
                      s.eigen ? (
                        <span
                          key={s.id}
                          className={`inline-flex items-center rounded-full border text-sm transition ${
                            s.aktiv
                              ? "border-bernstein bg-bernstein/15 text-schaum"
                              : "border-[var(--linie)] bg-nacht-2 text-schaum/50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSpielform(s.id)}
                            className="py-1.5 pl-3 pr-1"
                            title={s.beschreibung}
                          >
                            {s.titel}
                          </button>
                          <button
                            type="button"
                            onClick={() => eigeneSpielformEntfernen(s.id)}
                            className="py-1.5 pr-2 text-ziegel"
                            aria-label="entfernen"
                          >
                            ×
                          </button>
                        </span>
                      ) : (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSpielform(s.id)}
                          title={s.beschreibung}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            s.aktiv
                              ? "border-bernstein bg-bernstein/15 text-schaum"
                              : "border-[var(--linie)] bg-nacht-2 text-schaum/50"
                          }`}
                        >
                          {s.titel}
                        </button>
                      )
                    )}
                  </div>

                  {sfFormOffen ? (
                    <div className="space-y-2 rounded-xl border border-[var(--linie)] bg-nacht-2 p-3">
                      <Input
                        value={sfTitel}
                        onChange={(e) => setSfTitel(e.target.value)}
                        placeholder="Titel, z. B. Einbeinig"
                      />
                      <Input
                        value={sfBesch}
                        onChange={(e) => setSfBesch(e.target.value)}
                        placeholder="Kurze Regel / Beschreibung"
                      />
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={eigeneSpielformHinzufuegen}
                          disabled={!sfTitel.trim()}
                        >
                          Hinzufügen
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSfFormOffen(false);
                            setSfTitel("");
                            setSfBesch("");
                          }}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" className="w-full" onClick={() => setSfFormOffen(true)}>
                      + Eigene Spielform
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {fehler && <p className="text-sm text-ziegel">{fehler}</p>}
      </div>

      {aktiv && stops.length > 0 && !pickerOffen && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[var(--linie)] bg-nacht/95 backdrop-blur p-4">
          <div className="mx-auto max-w-md">
            <Button className="w-full" onClick={erstellen} disabled={busy}>
              {busy ? "erstelle…" : "Spiel erstellen & Code generieren"}
            </Button>
          </div>
        </div>
      )}

      {pickerOffen && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-nacht/95 backdrop-blur">
          <div className="mx-auto flex h-full w-full max-w-md flex-col px-4">
            <div className="flex items-center justify-between py-3">
              <h2 className="font-display text-xl">Kneipe hinzufügen</h2>
              <button
                onClick={() => setPickerOffen(false)}
                className="text-3xl leading-none text-schaum/60 hover:text-schaum"
                aria-label="schließen"
              >
                ×
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-nacht-3 p-1">
              <button
                onClick={() => setPickerTab("liste")}
                disabled={vorlagen.length === 0}
                className={`rounded-lg py-2 text-sm font-semibold transition disabled:opacity-40 ${
                  pickerTab === "liste" ? "bg-bernstein text-[#2a1d0a]" : "text-schaum/70"
                }`}
              >
                Aus Liste
              </button>
              <button
                onClick={() => setPickerTab("selbst")}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  pickerTab === "selbst" ? "bg-bernstein text-[#2a1d0a]" : "text-schaum/70"
                }`}
              >
                Selbst hinzufügen
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              {pickerTab === "liste" ? (
                verfuegbareVorlagen.length === 0 ? (
                  <p className="mt-6 text-center text-sm text-schaum/50">
                    Alle vorgeschlagenen Kneipen sind schon in der Route. Wechsle zu „Selbst
                    hinzufügen".
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {verfuegbareVorlagen.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center gap-2 rounded-xl border border-[var(--linie)] bg-nacht-3 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{v.name}</span>
                          {v.adresse && (
                            <span className="block truncate text-xs text-schaum/50">{v.adresse}</span>
                          )}
                        </span>
                        <button
                          onClick={() => vorlageHinzufuegen(v)}
                          className="shrink-0 rounded-lg bg-bernstein px-3 py-2 text-sm font-semibold text-[#2a1d0a]"
                        >
                          + Hinzufügen
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className="space-y-3">
                  <AdressSuche
                    naehe={stadt ? [stadt.lat, stadt.lng] : null}
                    placeholder="Adresse oder Kneipe suchen…"
                    onWaehlen={ausSucheWaehlen}
                  />
                  <div className="relative h-64 overflow-hidden rounded-xl border border-[var(--linie)]">
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
                  {pending ? (
                    <div className="space-y-2 rounded-xl border border-bernstein/50 bg-nacht-3 p-3">
                      <Input
                        value={pending.name}
                        onChange={(e) => setPending((p) => (p ? { ...p, name: e.target.value } : p))}
                        placeholder="Name der Kneipe"
                      />
                      <p className="truncate text-xs text-schaum/50">
                        📍 {pending.adresse ?? "Position auf der Karte gewählt"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={pendingBestaetigen}
                          disabled={!pending.name.trim()}
                        >
                          + Als Stop hinzufügen
                        </Button>
                        <Button variant="ghost" onClick={pendingVerwerfen}>
                          Verwerfen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-schaum/40">
                      Tippe auf die Karte oder such eine Adresse. Den Pin kannst du zum Feinjustieren
                      verschieben.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="py-3">
              <Button className="w-full" onClick={() => setPickerOffen(false)}>
                Fertig · {stops.length} Stops
              </Button>
            </div>
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
