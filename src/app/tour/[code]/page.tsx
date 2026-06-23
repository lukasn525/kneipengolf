"use client";

import dynamic from "next/dynamic";
import { useCallbackRef } from "@/components/useCallbackRef";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import { rangliste } from "@/lib/game";
import type {
  Ergebnis,
  KneipenChallenge,
  Spielform,
  Stadt,
  Teilnehmer,
  Tour,
  TourKneipe,
} from "@/lib/types";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="h-full w-full grid place-items-center text-schaum/40">Karte lädt…</div>,
});

const aktivKey = (code: string) => `kg-aktiv-${code}`;

function TourInner() {
  const { code } = useParams<{ code: string }>();
  const upper = (code || "").toUpperCase();
  const { user } = useSession();
  const router = useRouter();

  const [tour, setTour] = useState<Tour | null>(null);
  const [stadt, setStadt] = useState<Stadt | null>(null);
  const [kneipen, setKneipen] = useState<TourKneipe[]>([]);
  const [spielformen, setSpielformen] = useState<Spielform[]>([]);
  const [challenges, setChallenges] = useState<KneipenChallenge[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[]>([]);
  const [aktivId, setAktivId] = useState<string | null>(null);
  const [tab, setTab] = useState<"karte" | "rangliste">("karte");
  const [panel, setPanel] = useState<TourKneipe | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [bereit, setBereit] = useState(false);

  // ── Laden ──────────────────────────────────────────────
  const ladeAlles = useCallbackRef(async () => {
    const sb = supabase();
    const { data: t } = await sb.from("touren").select("*").eq("code", upper).maybeSingle();
    if (!t) {
      setLadefehler("Tour nicht gefunden.");
      setBereit(true);
      return;
    }
    setTour(t as Tour);
    const [k, c, te, er, sf] = await Promise.all([
      sb.from("tour_kneipen").select("*").eq("tour_id", t.id).order("position"),
      sb.from("kneipen_challenge").select("*").eq("tour_id", t.id),
      sb.from("teilnehmer").select("*").eq("tour_id", t.id).order("erstellt_am"),
      sb.from("ergebnisse").select("*").eq("tour_id", t.id),
      sb.from("spielformen").select("*"),
    ]);
    setKneipen((k.data as TourKneipe[]) ?? []);
    setChallenges((c.data as KneipenChallenge[]) ?? []);
    setTeilnehmer((te.data as Teilnehmer[]) ?? []);
    setErgebnisse((er.data as Ergebnis[]) ?? []);
    setSpielformen((sf.data as Spielform[]) ?? []);
    if (t.stadt_id) {
      const { data: s } = await sb.from("staedte").select("*").eq("id", t.stadt_id).maybeSingle();
      setStadt((s as Stadt) ?? null);
    }
    setBereit(true);
  });

  useEffect(() => {
    ladeAlles();
  }, [upper]); // eslint-disable-line react-hooks/exhaustive-deps

  // aktiver Teilnehmer aus localStorage / eigener user
  useEffect(() => {
    if (!teilnehmer.length) return;
    const gespeichert = typeof window !== "undefined" ? localStorage.getItem(aktivKey(upper)) : null;
    if (gespeichert && teilnehmer.some((t) => t.id === gespeichert)) {
      setAktivId(gespeichert);
      return;
    }
    const eigener = teilnehmer.find((t) => t.user_id === user?.id);
    if (eigener) setAktivId(eigener.id);
  }, [teilnehmer, user, upper]);

  function waehleAktiv(id: string) {
    setAktivId(id);
    localStorage.setItem(aktivKey(upper), id);
  }

  // ── Realtime ───────────────────────────────────────────
  useEffect(() => {
    if (!tour) return;
    const sb = supabase();
    const ch = sb
      .channel(`tour-${tour.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ergebnisse", filter: `tour_id=eq.${tour.id}` }, () => ladeErgebnisse(tour.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "teilnehmer", filter: `tour_id=eq.${tour.id}` }, () => ladeTeilnehmer(tour.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "touren", filter: `id=eq.${tour.id}` }, (p) => setTour((alt) => ({ ...(alt as Tour), ...(p.new as Tour) })))
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [tour?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ladeErgebnisse(tourId: string) {
    const { data } = await supabase().from("ergebnisse").select("*").eq("tour_id", tourId);
    setErgebnisse((data as Ergebnis[]) ?? []);
  }
  async function ladeTeilnehmer(tourId: string) {
    const { data } = await supabase().from("teilnehmer").select("*").eq("tour_id", tourId).order("erstellt_am");
    setTeilnehmer((data as Teilnehmer[]) ?? []);
  }

  // Bei Tour-Ende automatisch zur Auswertung springen (für alle Geräte)
  useEffect(() => {
    if (tour?.status === "beendet") setTab("rangliste");
  }, [tour?.status]);

  // ── Abgeleitet ─────────────────────────────────────────
  const istHost = tour?.host_user_id === user?.id;
  const erledigtSet = useMemo(() => {
    const s = new Set<string>();
    if (!aktivId) return s;
    ergebnisse.filter((e) => e.teilnehmer_id === aktivId && e.erledigt).forEach((e) => s.add(e.tour_kneipe_id));
    return s;
  }, [ergebnisse, aktivId]);

  function ergebnisFuer(kneipeId: string, tid: string) {
    return ergebnisse.find((e) => e.tour_kneipe_id === kneipeId && e.teilnehmer_id === tid) ?? null;
  }
  function spielformFuer(kneipeId: string): Spielform | null {
    const c = challenges.find((x) => x.tour_kneipe_id === kneipeId);
    if (!c) return null;
    return spielformen.find((s) => s.id === c.spielform_id) ?? null;
  }

  // ── Aktionen ───────────────────────────────────────────
  async function teilnehmerHinzufuegen(name: string, alsGeraet: boolean) {
    if (!tour || !name.trim()) return;
    const { data } = await supabase()
      .from("teilnehmer")
      .insert({ tour_id: tour.id, name: name.trim(), user_id: alsGeraet ? user?.id ?? null : null })
      .select()
      .single();
    if (data) {
      await ladeTeilnehmer(tour.id);
      if (alsGeraet) waehleAktiv((data as Teilnehmer).id);
    }
  }

  async function speichereErgebnis(kneipeId: string, patch: Partial<Ergebnis>) {
    if (!tour || !aktivId) return;
    const bestehend = ergebnisFuer(kneipeId, aktivId);
    const merged = {
      tour_id: tour.id,
      tour_kneipe_id: kneipeId,
      teilnehmer_id: aktivId,
      schlucke: bestehend?.schlucke ?? 0,
      strafschlucke: bestehend?.strafschlucke ?? 0,
      erledigt: bestehend?.erledigt ?? false,
      ...patch,
    };
    // optimistisch
    setErgebnisse((prev) => {
      const rest = prev.filter((e) => !(e.tour_kneipe_id === kneipeId && e.teilnehmer_id === aktivId));
      return [...rest, { ...(bestehend ?? {}), ...merged, id: bestehend?.id ?? `tmp-${kneipeId}-${aktivId}` } as Ergebnis];
    });
    await supabase()
      .from("ergebnisse")
      .upsert(merged, { onConflict: "tour_id,tour_kneipe_id,teilnehmer_id" });
    await ladeErgebnisse(tour.id);
  }

  async function setStatus(status: Tour["status"]) {
    if (!tour) return;
    await supabase().from("touren").update({ status }).eq("id", tour.id);
    setTour({ ...tour, status });
  }

  // ── Render ─────────────────────────────────────────────
  if (!bereit) {
    return (
      <Shell>
        <TopBar />
        <div className="flex-1 grid place-items-center text-schaum/50">lädt…</div>
      </Shell>
    );
  }
  if (ladefehler || !tour) {
    return (
      <Shell>
        <TopBar />
        <Card>
          <p className="text-ziegel">{ladefehler ?? "Fehler."}</p>
        </Card>
      </Shell>
    );
  }

  const center: [number, number] = stadt ? [stadt.lat, stadt.lng] : kneipen[0] ? [kneipen[0].lat, kneipen[0].lng] : [50.7344, 7.0989];

  if (tour.status === "lobby") {
    return (
      <Lobby
        tour={tour}
        teilnehmer={teilnehmer}
        istHost={istHost}
        aktivId={aktivId}
        onWaehleAktiv={waehleAktiv}
        onAdd={teilnehmerHinzufuegen}
        onStart={() => setStatus("laufend")}
      />
    );
  }

  return (
    <div className="flex flex-col h-dvh">
      <div className="mx-auto w-full max-w-md px-4">
        <TopBar />
      </div>

      {/* aktiver Spieler + Tabs */}
      <div className="mx-auto w-full max-w-md px-4 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-schaum/60 whitespace-nowrap">Du spielst als</span>
          <select
            value={aktivId ?? ""}
            onChange={(e) => waehleAktiv(e.target.value)}
            className="flex-1 rounded-lg bg-nacht-2 border border-[var(--linie)] px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Spieler wählen
            </option>
            {teilnehmer.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-nacht-3">
          {(["karte", "rangliste"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTab(m)}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                tab === m ? "bg-bernstein text-[#2a1d0a]" : "text-schaum/70"
              }`}
            >
              {m === "karte" ? "Karte" : "Rangliste"}
            </button>
          ))}
        </div>
      </div>

      {tab === "karte" ? (
        <div className="relative flex-1 min-h-0">
          <Map
            stops={kneipen}
            erledigt={erledigtSet}
            onPin={setPanel}
            center={center}
            zoom={stadt?.zoom ?? 14}
            glas={tour.glas_typ ?? "bier"}
          />
          {!aktivId && (
            <div className="absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-ziegel px-4 py-2 text-sm">
              Wähle oben deinen Spieler, dann tippe eine Kneipe an.
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto mx-auto w-full max-w-md px-4 pb-6">
          <Ranglisten tour={tour} teilnehmer={teilnehmer} ergebnisse={ergebnisse} aktivId={aktivId} />
          {tour.status === "laufend" && istHost && (
            <Button variant="danger" className="w-full mt-4" onClick={() => setStatus("beendet")}>
              Tour beenden & auswerten
            </Button>
          )}
          {tour.status === "beendet" && (
            <div className="mt-4 space-y-2">
              <p className="text-center text-sm text-schaum/60">Die Tour ist beendet. 🍻</p>
              <Button className="w-full" onClick={() => router.push("/dashboard")}>
                Zurück zum Dashboard
              </Button>
            </div>
          )}
        </div>
      )}

      {tour.status === "beendet" && tab === "karte" && (
        <div className="mx-auto w-full max-w-md px-4 pb-4">
          <Button className="w-full" onClick={() => setTab("rangliste")}>
            🏆 Zur Endauswertung
          </Button>
        </div>
      )}

      {panel && (
        <ChallengePanel
          kneipe={panel}
          nummer={kneipen.findIndex((k) => k.id === panel.id) + 1}
          spielform={spielformFuer(panel.id)}
          ergebnis={aktivId ? ergebnisFuer(panel.id, aktivId) : null}
          aktiv={Boolean(aktivId) && tour.status === "laufend"}
          verweigerungStrafe={tour.verweigerung_strafe}
          onChange={(patch) => speichereErgebnis(panel.id, patch)}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}

// ── Lobby ────────────────────────────────────────────────
function Lobby({
  tour,
  teilnehmer,
  istHost,
  aktivId,
  onWaehleAktiv,
  onAdd,
  onStart,
}: {
  tour: Tour;
  teilnehmer: Teilnehmer[];
  istHost: boolean;
  aktivId: string | null;
  onWaehleAktiv: (id: string) => void;
  onAdd: (name: string, alsGeraet: boolean) => void;
  onStart: () => void;
}) {
  const [name, setName] = useState("");
  const [weitere, setWeitere] = useState("");
  const [kopiert, setKopiert] = useState(false);
  const habeMich = teilnehmer.some((t) => t.id === aktivId);

  function teilen() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard?.writeText(url).then(() => {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    });
  }

  return (
    <Shell>
      <TopBar />
      <div className="space-y-5 mt-2">
        <Card className="text-center space-y-2">
          <p className="text-sm text-schaum/60">Tour-Code</p>
          <p className="mono text-3xl text-bernstein tracking-wider">{tour.code}</p>
          {tour.name && <p className="text-schaum/70">{tour.name}</p>}
          <Button variant="ghost" className="w-full" onClick={teilen}>
            {kopiert ? "Link kopiert ✓" : "Einladungslink kopieren"}
          </Button>
          <p className="text-xs text-schaum/40">Mitspieler öffnen den Link oder geben den Code im Dashboard ein.</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Mitspieler ({teilnehmer.length})</h2>
          {teilnehmer.length === 0 ? (
            <p className="text-sm text-schaum/50">Noch niemand dabei.</p>
          ) : (
            <ul className="space-y-1">
              {teilnehmer.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    t.id === aktivId ? "bg-nacht-3 border border-bernstein/50" : "bg-nacht-3"
                  }`}
                >
                  <span>{t.name}</span>
                  <button onClick={() => onWaehleAktiv(t.id)} className="text-xs text-schaum/50 hover:text-bernstein">
                    {t.id === aktivId ? "das bin ich" : "als diese:r spielen"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!habeMich && (
            <div className="space-y-2 pt-2">
              <Field label="Tritt bei mit deinem Namen">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" />
              </Field>
              <Button
                className="w-full"
                disabled={!name.trim()}
                onClick={() => {
                  onAdd(name, true);
                  setName("");
                }}
              >
                Beitreten
              </Button>
            </div>
          )}

          <div className="rounded-xl border border-dashed border-[var(--linie)] p-3 space-y-2">
            <span className="text-sm text-schaum/70">Weitere Person auf diesem Gerät</span>
            <Input value={weitere} onChange={(e) => setWeitere(e.target.value)} placeholder="Name" />
            <Button
              variant="ghost"
              className="w-full"
              disabled={!weitere.trim()}
              onClick={() => {
                onAdd(weitere, false);
                setWeitere("");
              }}
            >
              + Hinzufügen
            </Button>
          </div>
        </Card>

        {istHost ? (
          <Button className="w-full" disabled={teilnehmer.length === 0} onClick={onStart}>
            Tour starten
          </Button>
        ) : (
          <p className="text-center text-sm text-schaum/50">Warten, bis die Gastgeberin die Tour startet…</p>
        )}
      </div>
    </Shell>
  );
}

// ── Rangliste ────────────────────────────────────────────
function Ranglisten({
  tour,
  teilnehmer,
  ergebnisse,
  aktivId,
}: {
  tour: Tour;
  teilnehmer: Teilnehmer[];
  ergebnisse: Ergebnis[];
  aktivId: string | null;
}) {
  const zeilen = rangliste(teilnehmer, ergebnisse, tour);
  const beendet = tour.status === "beendet";
  return (
    <Card className="space-y-3">
      <h2 className="font-display text-xl">{beendet ? "🏆 Endauswertung" : "Rangliste (live)"}</h2>
      {zeilen.length === 0 ? (
        <p className="text-sm text-schaum/50">Noch keine Wertungen.</p>
      ) : (
        <ol className="space-y-1">
          {zeilen.map((z, i) => (
            <li
              key={z.teilnehmer.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                i === 0 && z.erledigt > 0 ? "bg-bernstein/15 border border-bernstein/40" : "bg-nacht-3"
              } ${z.teilnehmer.id === aktivId ? "ring-1 ring-bernstein/40" : ""}`}
            >
              <span className="mono w-6 text-center text-bernstein">{i + 1}</span>
              <span className="flex-1 min-w-0 truncate">
                {i === 0 && z.erledigt > 0 ? "👑 " : ""}
                {z.teilnehmer.name}
              </span>
              <span className="text-xs text-schaum/50">{z.erledigt} Stops</span>
              <span className="mono text-lg w-10 text-right">{z.gesamt}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-schaum/40">Niedrigster Gesamtwert gewinnt (Golf). Inkl. Strafpunkte über Par.</p>
    </Card>
  );
}

// ── Challenge-Panel ──────────────────────────────────────
function ChallengePanel({
  kneipe,
  nummer,
  spielform,
  ergebnis,
  aktiv,
  verweigerungStrafe,
  onChange,
  onClose,
}: {
  kneipe: TourKneipe;
  nummer: number;
  spielform: Spielform | null;
  ergebnis: Ergebnis | null;
  aktiv: boolean;
  verweigerungStrafe: number;
  onChange: (patch: Partial<Ergebnis>) => void;
  onClose: () => void;
}) {
  const schlucke = ergebnis?.schlucke ?? 0;
  const erledigt = ergebnis?.erledigt ?? false;
  const verweigert = (ergebnis?.strafschlucke ?? 0) > 0 && schlucke === 0 && erledigt;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-nacht-2 border-t border-[var(--linie)] p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-schaum/50">Stop {nummer}</p>
            <h2 className="font-display text-xl">{kneipe.name}</h2>
            {kneipe.adresse && <p className="text-sm text-schaum/50">{kneipe.adresse}</p>}
          </div>
          <button onClick={onClose} className="text-2xl text-schaum/50 leading-none">
            ×
          </button>
        </div>

        <div className="rounded-2xl bg-nacht-3 border border-[var(--linie)] p-4">
          <p className="text-xs uppercase tracking-wide text-bernstein mb-1">Challenge</p>
          {spielform ? (
            <>
              <h3 className="font-display text-lg">{spielform.titel}</h3>
              <p className="text-sm text-schaum/80">{spielform.beschreibung}</p>
            </>
          ) : (
            <p className="text-sm text-schaum/50">Keine Spielform hinterlegt.</p>
          )}
        </div>

        {!aktiv ? (
          <p className="text-sm text-schaum/50 text-center">
            Wähle oben einen Spieler und starte die Tour, um zu werten.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-2xl bg-nacht-3 border border-[var(--linie)] p-4">
              <span className="text-sm text-schaum/70">Schlücke</span>
              <div className="flex items-center gap-4">
                <button
                  className="h-10 w-10 rounded-full bg-nacht-2 border border-[var(--linie)] text-xl"
                  onClick={() => onChange({ schlucke: Math.max(0, schlucke - 1), strafschlucke: 0 })}
                >
                  –
                </button>
                <span className="mono text-2xl w-8 text-center">{schlucke}</span>
                <button
                  className="h-10 w-10 rounded-full bg-bernstein text-[#2a1d0a] text-xl"
                  onClick={() => onChange({ schlucke: schlucke + 1, strafschlucke: 0 })}
                >
                  +
                </button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => onChange({ erledigt: !erledigt })}
              variant={erledigt ? "ghost" : "primary"}
            >
              {erledigt ? "Erledigt ✓ (tippen zum Zurücknehmen)" : "Als erledigt markieren"}
            </Button>

            <button
              onClick={() => onChange({ erledigt: true, schlucke: 0, strafschlucke: verweigerungStrafe })}
              className={`w-full text-sm py-2 rounded-xl border border-[var(--linie)] ${
                verweigert ? "bg-ziegel/20 text-ziegel" : "text-schaum/60 hover:text-schaum"
              }`}
            >
              Challenge nicht machbar (+{verweigerungStrafe} Strafschlücke)
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function TourPage() {
  return (
    <Guard>
      <TourInner />
    </Guard>
  );
}
