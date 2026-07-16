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
import { rangliste, tourCode } from "@/lib/game";
import { holeRoute, googleMapsUrl } from "@/lib/nav";
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
  const [aktionsFehler, setAktionsFehler] = useState<string | null>(null);
  const [panel, setPanel] = useState<TourKneipe | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [bereit, setBereit] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [rematchBusy, setRematchBusy] = useState(false);

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

  // Straßenfolgende Route zwischen den Stops laden
  useEffect(() => {
    if (kneipen.length < 2) {
      setRouteCoords([]);
      return;
    }
    let ab = false;
    holeRoute(kneipen.map((k) => [k.lat, k.lng] as [number, number])).then((r) => {
      if (!ab) setRouteCoords(r?.coords ?? []);
    });
    return () => {
      ab = true;
    };
  }, [kneipen]);

  useEffect(() => {
    if (!aktionsFehler) return;
    const t = setTimeout(() => setAktionsFehler(null), 5000);
    return () => clearTimeout(t);
  }, [aktionsFehler]);

  // ── Abgeleitet ─────────────────────────────────────────
  const istHost = tour?.host_user_id === user?.id;
  const erledigtSet = useMemo(() => {
    const s = new Set<string>();
    if (!aktivId) return s;
    ergebnisse.filter((e) => e.teilnehmer_id === aktivId && e.erledigt).forEach((e) => s.add(e.tour_kneipe_id));
    return s;
  }, [ergebnisse, aktivId]);
  // Nächster noch offener Stop des aktiven Spielers (in Routenreihenfolge)
  const naechsterStop = useMemo(
    () => (aktivId ? kneipen.find((k) => !erledigtSet.has(k.id)) ?? null : null),
    [kneipen, erledigtSet, aktivId]
  );

  function ergebnisFuer(kneipeId: string, tid: string) {
    return ergebnisse.find((e) => e.tour_kneipe_id === kneipeId && e.teilnehmer_id === tid) ?? null;
  }
  function challengeFuer(kneipeId: string): { titel: string; beschreibung: string } | null {
    const c = challenges.find((x) => x.tour_kneipe_id === kneipeId);
    if (!c) return null;
    // Neue Touren speichern den Challenge-Text direkt (Snapshot, auch eigene Spielformen);
    // ältere Touren nutzen den Verweis auf die Spielformen-Tabelle.
    if (c.titel) return { titel: c.titel, beschreibung: c.beschreibung ?? "" };
    const sf = spielformen.find((s) => s.id === c.spielform_id);
    return sf ? { titel: sf.titel, beschreibung: sf.beschreibung } : null;
  }

  // ── Aktionen ───────────────────────────────────────────
  async function teilnehmerHinzufuegen(name: string, alsGeraet: boolean) {
    if (!tour || !name.trim()) return;
    const { data, error } = await supabase()
      .from("teilnehmer")
      .insert({ tour_id: tour.id, name: name.trim(), user_id: alsGeraet ? user?.id ?? null : null })
      .select()
      .single();
    if (error) {
      setAktionsFehler("Beitreten fehlgeschlagen: " + error.message);
      return;
    }
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
    const { error } = await supabase()
      .from("ergebnisse")
      .upsert(merged, { onConflict: "tour_id,tour_kneipe_id,teilnehmer_id" });
    if (error) setAktionsFehler("Speichern fehlgeschlagen: " + error.message);
    await ladeErgebnisse(tour.id);
  }

  async function setStatus(status: Tour["status"]) {
    if (!tour) return;
    await supabase().from("touren").update({ status }).eq("id", tour.id);
    setTour({ ...tour, status });
  }

  async function ergebnisTeilen() {
    const zeilen = rangliste(teilnehmer, ergebnisse, tour!);
    const liste = zeilen.map((z, i) => `${i + 1}. ${z.teilnehmer.name} – ${z.gesamt}`).join("\n");
    const text = `🍺 Kneipen-Golf${tour?.name ? " – " + tour.name : ""}\n${liste}`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Kneipen-Golf Ergebnis", text, url });
      } catch {
        /* Abbruch – ignorieren */
      }
    } else {
      navigator.clipboard?.writeText(`${text}\n${url}`);
      setAktionsFehler("Ergebnis in die Zwischenablage kopiert.");
    }
  }

  async function rematch() {
    if (!tour || !user || rematchBusy) return;
    setRematchBusy(true);
    const sb = supabase();
    try {
      const code = tourCode(stadt?.name || tour.name || "TOUR");
      const { data: neu, error } = await sb
        .from("touren")
        .insert({
          code,
          name: tour.name,
          stadt_id: tour.stadt_id,
          host_user_id: user.id,
          par_schwelle: tour.par_schwelle,
          strafe_aktiv: tour.strafe_aktiv,
          strafe_pro_schluck: tour.strafe_pro_schluck,
          verweigerung_strafe: tour.verweigerung_strafe,
          glas_typ: tour.glas_typ,
          spiel_modus: tour.spiel_modus,
          status: "lobby",
        })
        .select()
        .single();
      if (error || !neu) throw error ?? new Error("Fehler");
      const rows = kneipen.map((k, i) => ({
        tour_id: neu.id,
        name: k.name,
        lat: k.lat,
        lng: k.lng,
        adresse: k.adresse,
        position: i,
      }));
      const { data: neueKneipen } = await sb.from("tour_kneipen").insert(rows).select();
      if (neueKneipen && challenges.length) {
        const pool = challenges.map((c) => ({
          spielform_id: c.spielform_id,
          titel: c.titel ?? null,
          beschreibung: c.beschreibung ?? null,
        }));
        const ch = neueKneipen.map((k: any) => {
          const p = pool[Math.floor(Math.random() * pool.length)];
          return {
            tour_id: neu.id,
            tour_kneipe_id: k.id,
            spielform_id: p.spielform_id,
            titel: p.titel,
            beschreibung: p.beschreibung,
          };
        });
        await sb.from("kneipen_challenge").insert(ch);
      }
      router.push(`/tour/${code}`);
    } catch {
      setAktionsFehler("Rematch fehlgeschlagen.");
      setRematchBusy(false);
    }
  }

  // ── Render ─────────────────────────────────────────────
  if (!bereit) {
    return (
      <Shell>
        <TopBar />
        <div className="mt-2 space-y-3">
          <div className="kg-skeleton h-24 w-full" />
          <div className="kg-skeleton h-10 w-full" />
          <div className="kg-skeleton h-64 w-full" />
        </div>
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
        fehler={aktionsFehler}
        onFehlerClose={() => setAktionsFehler(null)}
        standardName={(user?.user_metadata?.display_name as string) || ""}
      />
    );
  }

  return (
    <div className="flex flex-col h-dvh">
      {aktionsFehler && <Toast msg={aktionsFehler} onClose={() => setAktionsFehler(null)} />}
      <div className="mx-auto w-full max-w-md px-4">
        <TopBar />
      </div>

      {/* aktiver Spieler + Tabs */}
      <div className="mx-auto w-full max-w-md px-4 pb-2 space-y-2">
        <div className="space-y-1">
          <span className="text-sm text-schaum/60">
            {tour.spiel_modus === "team" ? "Ihr spielt als" : "Du spielst als"}
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {teilnehmer.map((t) => (
              <button
                key={t.id}
                onClick={() => waehleAktiv(t.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
                  t.id === aktivId
                    ? "border-bernstein bg-bernstein/15 text-schaum"
                    : "border-[var(--linie)] bg-nacht-2 text-schaum/60"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
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

      {tab === "karte" && aktivId && tour.status === "laufend" && (
        <div className="mx-auto w-full max-w-md px-4 pb-2">
          <button
            onClick={() => naechsterStop && setPanel(naechsterStop)}
            disabled={!naechsterStop}
            className="w-full rounded-xl border border-bernstein/50 bg-nacht-2 p-3 text-left disabled:opacity-70"
          >
            {naechsterStop ? (
              <>
                <span className="text-xs text-schaum/50">
                  Nächster Stop · {erledigtSet.size}/{kneipen.length} erledigt
                </span>
                <span className="block font-display text-lg">{naechsterStop.name}</span>
              </>
            ) : (
              <span className="block font-display text-lg">Alle Stops erledigt 🎉</span>
            )}
          </button>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-nacht-3">
            <div
              className="h-full bg-bernstein transition-all"
              style={{ width: `${kneipen.length ? (erledigtSet.size / kneipen.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {tab === "karte" ? (
        <div className="relative flex-1 min-h-0">
          <Map
            stops={kneipen}
            erledigt={erledigtSet}
            onPin={setPanel}
            center={center}
            zoom={stadt?.zoom ?? 14}
            glas={tour.glas_typ ?? "bier"}
            routeCoords={routeCoords}
            route
          />
          {!aktivId && (
            <div className="absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-ziegel px-4 py-2 text-sm">
              Wähle oben deinen Spieler, dann tippe eine Kneipe an.
            </div>
          )}
          {kneipen.length > 0 && (
            <a
              href={googleMapsUrl(kneipen.map((k) => [k.lat, k.lng] as [number, number]))}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 z-[900] flex items-center gap-2 rounded-full bg-bernstein px-4 py-3 text-sm font-semibold text-[#2a1d0a] shadow-lg active:brightness-95"
            >
              🧭 Navigieren
            </a>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto mx-auto w-full max-w-md px-4 pb-6">
          <Ranglisten tour={tour} teilnehmer={teilnehmer} ergebnisse={ergebnisse} aktivId={aktivId} />
          {tour.status === "laufend" && istHost && (
            <Button
              variant="danger"
              className="w-full mt-4"
              onClick={() => {
                if (
                  window.confirm(
                    "Tour wirklich beenden und auswerten? Das lässt sich nicht rückgängig machen."
                  )
                ) {
                  setStatus("beendet");
                }
              }}
            >
              Tour beenden & auswerten
            </Button>
          )}
          {tour.status === "beendet" && (
            <div className="mt-4 space-y-2">
              <Button className="w-full" onClick={ergebnisTeilen}>
                Ergebnis teilen
              </Button>
              {istHost && (
                <Button variant="ghost" className="w-full" onClick={rematch} disabled={rematchBusy}>
                  {rematchBusy ? "…" : "Nochmal spielen (gleiche Route)"}
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => router.push("/dashboard")}>
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
          challenge={challengeFuer(panel.id)}
          ergebnis={aktivId ? ergebnisFuer(panel.id, aktivId) : null}
          aktiv={Boolean(aktivId) && tour.status === "laufend"}
          verweigerungStrafe={tour.verweigerung_strafe}
          par={tour.par_schwelle}
          onChange={(patch) => speichereErgebnis(panel.id, patch)}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="fixed inset-x-0 top-3 z-[1100] mx-auto block w-fit max-w-[92%] rounded-xl bg-ziegel px-4 py-2 text-sm text-schaum shadow-lg"
    >
      {msg} ✕
    </button>
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
  fehler,
  onFehlerClose,
  standardName,
}: {
  tour: Tour;
  teilnehmer: Teilnehmer[];
  istHost: boolean;
  aktivId: string | null;
  onWaehleAktiv: (id: string) => void;
  onAdd: (name: string, alsGeraet: boolean) => void;
  onStart: () => void;
  fehler?: string | null;
  onFehlerClose?: () => void;
  standardName?: string;
}) {
  const [name, setName] = useState("");
  const [weitere, setWeitere] = useState("");
  const [kopiert, setKopiert] = useState(false);
  const [einladungsUrl, setEinladungsUrl] = useState("");
  const habeMich = teilnehmer.some((t) => t.id === aktivId);
  const team = tour.spiel_modus === "team";

  useEffect(() => {
    setEinladungsUrl(window.location.href);
  }, []);

  // Im Einzelspieler-Modus den festen Nickname vorschlagen
  useEffect(() => {
    if (standardName && !team) setName((n) => n || standardName);
  }, [standardName, team]);

  function kopieren() {
    if (!einladungsUrl) return;
    navigator.clipboard?.writeText(einladungsUrl).then(() => {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    });
  }
  async function teilen() {
    if (!einladungsUrl) return;
    const text = `Mach mit bei Kneipen-Golf! Code: ${tour.code}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Kneipen-Golf", text, url: einladungsUrl });
      } catch {
        /* Abbruch durch Nutzer – ignorieren */
      }
    } else {
      kopieren();
    }
  }

  return (
    <Shell>
      {fehler && <Toast msg={fehler} onClose={() => onFehlerClose?.()} />}
      <TopBar />
      <div className="space-y-5 mt-2">
        <Card className="text-center space-y-3">
          <p className="text-sm text-schaum/60">Tour-Code</p>
          <p className="mono text-3xl text-bernstein tracking-wider">{tour.code}</p>
          {tour.name && <p className="text-schaum/70">{tour.name}</p>}

          {einladungsUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(
                einladungsUrl
              )}`}
              alt="QR-Code zum Beitreten"
              className="mx-auto h-44 w-44 rounded-xl bg-white p-1"
              width={176}
              height={176}
            />
          )}
          <p className="text-xs text-schaum/40">Scannen zum Beitreten – oder Einladung teilen.</p>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={teilen}>
              Teilen
            </Button>
            <Button variant="ghost" className="flex-1" onClick={kopieren}>
              {kopiert ? "Kopiert ✓" : "Link kopieren"}
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">
            {team ? "Teams" : "Mitspieler"} ({teilnehmer.length})
          </h2>
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
              <Field label={team ? "Tritt bei mit eurem Team-Namen" : "Tritt bei mit deinem Namen"}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={team ? "Team-Name" : "Dein Name"}
                />
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
            <span className="text-sm text-schaum/70">
              {team ? "Weiteres Team auf diesem Gerät" : "Weitere Person auf diesem Gerät"}
            </span>
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
      {beendet && zeilen[0] && zeilen[0].erledigt > 0 && (
        <div className="kg-pop rounded-2xl border border-bernstein/40 bg-bernstein/10 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-schaum/50">Sieger</p>
          <p className="font-display text-2xl">👑 {zeilen[0].teilnehmer.name}</p>
          <p className="mono text-bernstein">{zeilen[0].gesamt} Punkte</p>
        </div>
      )}
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
  challenge,
  ergebnis,
  aktiv,
  verweigerungStrafe,
  par,
  onChange,
  onClose,
}: {
  kneipe: TourKneipe;
  nummer: number;
  challenge: { titel: string; beschreibung: string } | null;
  ergebnis: Ergebnis | null;
  aktiv: boolean;
  verweigerungStrafe: number;
  par: number;
  onChange: (patch: Partial<Ergebnis>) => void;
  onClose: () => void;
}) {
  const schlucke = ergebnis?.schlucke ?? 0;
  const erledigt = ergebnis?.erledigt ?? false;
  const verweigert = (ergebnis?.strafschlucke ?? 0) > 0 && schlucke === 0 && erledigt;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="kg-slide-up w-full max-w-md rounded-t-3xl bg-nacht-2 border-t border-[var(--linie)] p-5 pb-8 space-y-4 max-h-[88dvh] overflow-y-auto"
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
          {challenge ? (
            <>
              <h3 className="font-display text-lg">{challenge.titel}</h3>
              <p className="text-sm text-schaum/80">{challenge.beschreibung}</p>
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

            <p className="text-center text-xs text-schaum/50">
              {schlucke === par
                ? "genau Par"
                : schlucke > par
                  ? `${schlucke - par} über Par`
                  : `${par - schlucke} unter Par`}
            </p>

            <Button
              className="w-full"
              onClick={() => onChange({ erledigt: !erledigt })}
              variant={erledigt ? "ghost" : "primary"}
            >
              {erledigt ? "Erledigt ✓ (tippen zum Zurücknehmen)" : "Als erledigt markieren"}
            </Button>

            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Challenge als „nicht machbar" werten? Das gibt +${verweigerungStrafe} Strafschlücke.`
                  )
                ) {
                  onChange({ erledigt: true, schlucke: 0, strafschlucke: verweigerungStrafe });
                }
              }}
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
