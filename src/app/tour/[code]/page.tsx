"use client";

import dynamic from "next/dynamic";
import { useCallbackRef } from "@/components/useCallbackRef";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { SeitenKopf } from "@/components/SeitenKopf";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import { rangliste, scoreEintrag, tourCode } from "@/lib/game";
import { holeRoute, googleMapsUrl } from "@/lib/nav";
import { IconFlamme, IconKompass, IconPokal, IconWeiter, IconX } from "@/components/Icons";
import { geraetId } from "@/lib/ugc";
import { empfehlungSetzen, ladeEigeneEmpfehlungen } from "@/lib/beliebtheit";
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
  loading: () => <div className="h-full w-full grid place-items-center text-schaum/55">Karte lädt…</div>,
});

const aktivKey = (code: string) => `kg-aktiv-${code}`;
const cacheKey = (code: string) => `kg-cache-${code}`;

/** Letzter bekannter Tour-Stand für die Offline-Anzeige (Kneipen-WLAN…). */
type TourSnapshot = {
  tour: Tour;
  stadt: Stadt | null;
  kneipen: TourKneipe[];
  challenges: KneipenChallenge[];
  teilnehmer: Teilnehmer[];
  ergebnisse: Ergebnis[];
  spielformen: Spielform[];
};

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
  const [tab, setTab] = useState<"karte" | "stops" | "rangliste">("karte");
  const [aktionsFehler, setAktionsFehler] = useState<string | null>(null);
  const [panel, setPanel] = useState<TourKneipe | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [bereit, setBereit] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [rematchBusy, setRematchBusy] = useState(false);
  // Gameplay-Loop: Übergänge zwischen Spielern und Stops
  const [panelKomplettBeimOeffnen, setPanelKomplettBeimOeffnen] = useState(false);
  const [wartetAufAndere, setWartetAufAndere] = useState(false);
  const [wechselHinweis, setWechselHinweis] = useState<string | null>(null);
  const [fertigerStop, setFertigerStop] = useState<TourKneipe | null>(null);
  // Offline-Robustheit: zeigen wir gerade einen lokalen Stand? / wartende Wertungen
  const [offlineStand, setOfflineStand] = useState(false);
  const [wartend, setWartend] = useState<Record<string, Record<string, unknown>>>({});
  const wartendRef = useRef(wartend);
  wartendRef.current = wartend;

  // ── Laden ──────────────────────────────────────────────
  const ladeAlles = useCallbackRef(async () => {
    const sb = supabase();
    try {
      const { data: t, error: tErr } = await sb
        .from("touren")
        .select("*")
        .eq("code", upper)
        .maybeSingle();
      if (tErr) throw tErr; // Netz-/Serverfehler -> Offline-Fallback unten
      if (!t) {
        setLadefehler("Tour nicht gefunden.");
        setBereit(true);
        return;
      }
      const [k, c, te, er, sf] = await Promise.all([
        sb.from("tour_kneipen").select("*").eq("tour_id", t.id).order("position"),
        sb.from("kneipen_challenge").select("*").eq("tour_id", t.id),
        sb.from("teilnehmer").select("*").eq("tour_id", t.id).order("erstellt_am"),
        sb.from("ergebnisse").select("*").eq("tour_id", t.id),
        sb.from("spielformen").select("*"),
      ]);
      if (k.error) throw k.error;
      let s: Stadt | null = null;
      if (t.stadt_id) {
        const { data } = await sb.from("staedte").select("*").eq("id", t.stadt_id).maybeSingle();
        s = (data as Stadt) ?? null;
      }
      const snap: TourSnapshot = {
        tour: t as Tour,
        stadt: s,
        kneipen: (k.data as TourKneipe[]) ?? [],
        challenges: (c.data as KneipenChallenge[]) ?? [],
        teilnehmer: (te.data as Teilnehmer[]) ?? [],
        ergebnisse: (er.data as Ergebnis[]) ?? [],
        spielformen: (sf.data as Spielform[]) ?? [],
      };
      setTour(snap.tour);
      setStadt(snap.stadt);
      setKneipen(snap.kneipen);
      setChallenges(snap.challenges);
      setTeilnehmer(snap.teilnehmer);
      setErgebnisse(snap.ergebnisse);
      setSpielformen(snap.spielformen);
      setOfflineStand(false);
      setBereit(true);
      // Stand lokal sichern -> in der Kneipe ohne Netz trotzdem spielbar
      try {
        localStorage.setItem(cacheKey(upper), JSON.stringify(snap));
      } catch {
        /* Quota voll – Cache ist optional */
      }
    } catch {
      // Kein Netz: letzten lokalen Stand anzeigen, statt leer zu bleiben
      try {
        const roh = localStorage.getItem(cacheKey(upper));
        if (roh) {
          const snap = JSON.parse(roh) as TourSnapshot;
          setTour(snap.tour);
          setStadt(snap.stadt);
          setKneipen(snap.kneipen);
          setChallenges(snap.challenges);
          setTeilnehmer(snap.teilnehmer);
          setErgebnisse(snap.ergebnisse);
          setSpielformen(snap.spielformen);
          setOfflineStand(true);
          setBereit(true);
          return;
        }
      } catch {
        /* defekter Cache */
      }
      setLadefehler("Gerade keine Verbindung – bitte kurz später nochmal versuchen.");
      setBereit(true);
    }
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
    const { data, error } = await supabase().from("ergebnisse").select("*").eq("tour_id", tourId);
    if (error || !data) return; // bei Netzfehler lokalen (optimistischen) Stand behalten
    // Wartende, noch nicht synchronisierte Wertungen über den Server-Stand legen
    let rows = data as Ergebnis[];
    for (const merged of Object.values(wartendRef.current)) {
      const m = merged as unknown as Ergebnis;
      rows = rows.filter(
        (e) => !(e.tour_kneipe_id === m.tour_kneipe_id && e.teilnehmer_id === m.teilnehmer_id)
      );
      rows = [...rows, { ...m, id: `tmp-${m.tour_kneipe_id}-${m.teilnehmer_id}` }];
    }
    setErgebnisse(rows);
  }
  async function ladeTeilnehmer(tourId: string) {
    const { data, error } = await supabase()
      .from("teilnehmer")
      .select("*")
      .eq("tour_id", tourId)
      .order("erstellt_am");
    if (error || !data) return;
    setTeilnehmer(data as Teilnehmer[]);
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

  /**
   * Eigener Stand für die Kopfzeile. Bisher steckte diese Information nur
   * im Ranglisten-Tab – man musste also aktiv wegklicken, um zu sehen,
   * wie man steht. Das ist der Grund, warum man überhaupt spielt.
   */
  const meinStand = useMemo(() => {
    if (!tour || !aktivId) return null;
    const zeilen = rangliste(teilnehmer, ergebnisse, tour);
    const i = zeilen.findIndex((z) => z.teilnehmer.id === aktivId);
    if (i < 0) return null;
    return { platz: i + 1, gesamt: zeilen[i].gesamt, von: zeilen.length };
  }, [teilnehmer, ergebnisse, tour, aktivId]);

  // ── Gameplay: wen verwaltet dieses Gerät? ──────────────
  // Pass-and-Play: Teilnehmer mit unserer geraet_id. Für ältere Touren ohne
  // geraet_id fallen wir auf „eigener Account + Namen ohne Konto" zurück.
  const meinGeraet = useMemo(() => geraetId(), []);
  const meineTeilnehmer = useMemo(() => {
    const mitGeraet = teilnehmer.filter((t) => t.geraet_id === meinGeraet);
    if (mitGeraet.length) return mitGeraet;
    return teilnehmer.filter((t) => t.user_id === user?.id || t.user_id === null);
  }, [teilnehmer, meinGeraet, user?.id]);

  const binDabei = useMemo(
    () => teilnehmer.some((t) => t.geraet_id === meinGeraet || (!!user && t.user_id === user.id)),
    [teilnehmer, meinGeraet, user]
  );

  function hatGewertet(kneipeId: string, tid: string) {
    return ergebnisse.some(
      (e) => e.tour_kneipe_id === kneipeId && e.teilnehmer_id === tid && e.erledigt
    );
  }
  /** Haben ALLE Teilnehmer der Session diesen Stop gewertet? */
  function alleFertig(kneipeId: string) {
    return teilnehmer.length > 0 && teilnehmer.every((t) => hatGewertet(kneipeId, t.id));
  }

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
      .insert({
        tour_id: tour.id,
        name: name.trim(),
        user_id: alsGeraet ? user?.id ?? null : null,
        // Dieses Gerät verwaltet den Teilnehmer -> Basis für den Auto-Wechsel
        geraet_id: meinGeraet,
      })
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

  /**
   * Teilnehmer entfernen – nur die Person, die die Tour erstellt hat.
   * Nötig, weil ein Teilnehmer, der nicht (mehr) mitspielt, sonst jeden
   * Stop blockiert: der Übergang zum nächsten Game wartet auf ALLE.
   * Die Ergebnisse hängen per ON DELETE CASCADE mit dran.
   */
  async function teilnehmerEntfernen(t: Teilnehmer) {
    if (!tour || !istHost) return;
    if (
      !window.confirm(
        `${t.name} aus der Tour entfernen? Alle Wertungen dieser Person gehen verloren.`
      )
    )
      return;
    const { error } = await supabase().from("teilnehmer").delete().eq("id", t.id);
    if (error) {
      setAktionsFehler("Entfernen fehlgeschlagen: " + error.message);
      return;
    }
    if (aktivId === t.id) {
      setAktivId(null);
      localStorage.removeItem(aktivKey(upper));
    }
    await ladeTeilnehmer(tour.id);
    await ladeErgebnisse(tour.id);
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
    if (error) {
      // Kein Netz? Wertung bleibt sichtbar und wird nachgetragen, sobald es geht.
      setWartend((prev) => ({ ...prev, [`${kneipeId}:${aktivId}`]: merged }));
      return;
    }
    setWartend((prev) => {
      if (!(`${kneipeId}:${aktivId}` in prev)) return prev;
      const n = { ...prev };
      delete n[`${kneipeId}:${aktivId}`];
      return n;
    });
    await ladeErgebnisse(tour.id);
  }

  // ── Gameplay-Loop ──────────────────────────────────────

  /**
   * Öffnet den Stop und setzt direkt den ersten Spieler dieses Geräts, der
   * hier noch nichts eingetragen hat. `panelKomplettBeimOeffnen` merkt sich,
   * ob der Stop schon fertig war – nur dann darf das Fenster offen bleiben
   * (Nachschauen/Korrigieren statt sofortigem Auto-Close).
   */
  function oeffneStop(k: TourKneipe) {
    setPanelKomplettBeimOeffnen(alleFertig(k.id));
    setWartetAufAndere(false);
    setFertigerStop(null);
    if (tour?.status === "laufend") {
      const offen = meineTeilnehmer.find((t) => !hatGewertet(k.id, t.id));
      if (offen) waehleAktiv(offen.id);
    }
    setPanel(k);
  }

  /**
   * Wertung abschließen und den Loop weiterdrehen:
   *   1. nächster Spieler dieses Geräts ist dran (Fenster bleibt offen)
   *   2. sonst: warten, bis andere Geräte fertig sind
   *   3. sind alle durch → Fenster zu, „Nächstes Game" erscheint
   */
  async function wertungAbschliessen(kneipeId: string, patch: Partial<Ergebnis>) {
    if (!aktivId) return;
    const bereits = new Set(
      ergebnisse
        .filter((e) => e.tour_kneipe_id === kneipeId && e.erledigt)
        .map((e) => e.teilnehmer_id)
    );
    bereits.add(aktivId);

    await speichereErgebnis(kneipeId, { ...patch, erledigt: true });

    const naechster = meineTeilnehmer.find((t) => !bereits.has(t.id));
    if (naechster) {
      waehleAktiv(naechster.id);
      setWechselHinweis(naechster.name);
      return;
    }
    // Dieses Gerät ist durch – warten wir noch auf andere?
    const alle = teilnehmer.every((t) => bereits.has(t.id));
    if (alle) {
      const k = kneipen.find((x) => x.id === kneipeId) ?? null;
      setPanel(null);
      setWartetAufAndere(false);
      setFertigerStop(k);
    } else {
      setWartetAufAndere(true);
    }
  }

  // Multi-Device: sobald das letzte Gerät gewertet hat, schließt das Fenster
  // bei allen und der Übergang zum nächsten Stop erscheint.
  useEffect(() => {
    if (!panel || panelKomplettBeimOeffnen) return;
    if (!alleFertig(panel.id)) return;
    const k = panel;
    setPanel(null);
    setWartetAufAndere(false);
    setFertigerStop(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ergebnisse, teilnehmer, panel, panelKomplettBeimOeffnen]);

  // Hinweis „jetzt ist X dran" wieder ausblenden
  useEffect(() => {
    if (!wechselHinweis) return;
    const t = setTimeout(() => setWechselHinweis(null), 2200);
    return () => clearTimeout(t);
  }, [wechselHinweis]);

  // Wartende Wertungen nachtragen, sobald wieder Netz da ist
  useEffect(() => {
    if (!tour) return;
    if (!Object.keys(wartend).length && !offlineStand) return;
    let laeuft = false;
    const flush = async () => {
      if (laeuft) return;
      laeuft = true;
      try {
        const eintraege = Object.entries(wartendRef.current);
        let erfolg = false;
        for (const [key, merged] of eintraege) {
          const { error } = await supabase()
            .from("ergebnisse")
            .upsert(merged, { onConflict: "tour_id,tour_kneipe_id,teilnehmer_id" });
          if (error) break; // weiterhin offline -> später erneut
          erfolg = true;
          setWartend((prev) => {
            const n = { ...prev };
            delete n[key];
            return n;
          });
        }
        if (erfolg || offlineStand) await ladeAlles(); // frischen Stand holen
      } finally {
        laeuft = false;
      }
    };
    const iv = setInterval(flush, 8000);
    window.addEventListener("online", flush);
    return () => {
      clearInterval(iv);
      window.removeEventListener("online", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(wartend).length, offlineStand, tour?.id]);

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
        <SeitenKopf titel={upper} />
        <div className="mt-3 space-y-3">
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
        <SeitenKopf titel={upper} />
        <Card className="mt-3">
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
        <SeitenKopf titel={tour.name || tour.code} />
      </div>

      {/* aktiver Spieler + Tabs */}
      <div className="mx-auto w-full max-w-md px-4 pb-2 space-y-2">
        {(offlineStand || Object.keys(wartend).length > 0) && (
          <div className="rounded-xl border border-bernstein/40 bg-bernstein/10 px-3 py-2 text-xs text-schaum/80">
            {offlineStand
              ? "Kein Netz – du siehst den letzten bekannten Stand. Es wird automatisch neu verbunden."
              : `${Object.keys(wartend).length} Wertung${Object.keys(wartend).length > 1 ? "en werden" : " wird"} nachgetragen, sobald es wieder Netz gibt.`}
          </div>
        )}
        {meinStand && (
          <div className="flex items-end justify-between border-b border-[var(--linie)] pb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[.12em] text-schaum/55">
                {tour.spiel_modus === "team" ? "Euer Score" : "Dein Score"}
              </p>
              <p className="mono text-2xl leading-tight">{meinStand.gesamt}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[.12em] text-schaum/55">Stop</p>
              <p className="mono text-2xl leading-tight">
                {erledigtSet.size}
                <span className="text-base text-schaum/55">/{kneipen.length}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[.12em] text-schaum/55">Platz</p>
              <p className="mono text-2xl leading-tight text-bernstein">{meinStand.platz}.</p>
            </div>
          </div>
        )}

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
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-nacht-3">
          {(["karte", "stops", "rangliste"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTab(m)}
              className={`min-h-[44px] rounded-lg py-2 text-sm font-semibold transition ${
                tab === m ? "bg-bernstein text-tinte" : "text-schaum/70"
              }`}
            >
              {m === "karte" ? "Karte" : m === "stops" ? "Stops" : "Rangliste"}
            </button>
          ))}
        </div>
      </div>

      {/*
        Nachzügler: Wer bei laufender Tour dazukommt, hat noch keinen
        Teilnehmer auf diesem Gerät – ohne dieses Feld käme er gar nicht
        mehr rein, weil die Beitritts-Oberfläche sonst nur in der Lobby steht.
      */}
      {tour.status === "laufend" && (
        <div className="mx-auto w-full max-w-md px-4 pb-2">
          <NachzueglerBeitritt
            team={tour.spiel_modus === "team"}
            binDabei={binDabei}
            standardName={(user?.user_metadata?.display_name as string) || ""}
            onBeitreten={(name, alsGeraet) => teilnehmerHinzufuegen(name, alsGeraet)}
          />
        </div>
      )}

      {tab === "karte" && aktivId && tour.status === "laufend" && (
        <div className="mx-auto w-full max-w-md px-4 pb-2">
          <button
            onClick={() => naechsterStop && oeffneStop(naechsterStop)}
            disabled={!naechsterStop}
            className="w-full rounded-xl border border-bernstein/50 bg-nacht-2 p-3 text-left disabled:opacity-70"
          >
            {naechsterStop ? (
              <>
                <span className="text-xs text-schaum/60">
                  Nächster Stop · {erledigtSet.size}/{kneipen.length} erledigt
                </span>
                <span className="block font-display text-lg">{naechsterStop.name}</span>
              </>
            ) : (
              <span className="block font-display text-lg">Alle Stops erledigt</span>
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
            onPin={oeffneStop}
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
              className="absolute bottom-4 right-4 z-[900] flex items-center gap-2 rounded-full bg-bernstein px-4 py-3 text-sm font-semibold text-tinte shadow-lg active:brightness-95"
            >
              <IconKompass size={16} /> Navigieren
            </a>
          )}
        </div>
      ) : tab === "stops" ? (
        <div className="flex-1 overflow-auto mx-auto w-full max-w-md px-4 pb-6">
          <Scorecard
            tour={tour}
            kneipen={kneipen}
            ergebnisse={ergebnisse}
            aktivId={aktivId}
            challengeFuer={challengeFuer}
            onOeffnen={oeffneStop}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto mx-auto w-full max-w-md px-4 pb-6">
          <Ranglisten
            tour={tour}
            teilnehmer={teilnehmer}
            ergebnisse={ergebnisse}
            aktivId={aktivId}
            istHost={istHost}
            onEntfernen={teilnehmerEntfernen}
          />

          {tour.status === "beendet" && user && teilnehmer.some((t) => t.user_id === user.id) && (
            <KneipenBewertung tourId={tour.id} kneipen={kneipen} userId={user.id} />
          )}

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
            <IconPokal size={17} /> Zur Endauswertung
          </Button>
        </div>
      )}

      {/* Nahtloser Übergang: erscheint, sobald alle diesen Stop gewertet haben */}
      {fertigerStop && tour.status === "laufend" && (
        <NaechstesGame
          fertig={fertigerStop}
          naechster={kneipen.find((k) => !alleFertig(k.id)) ?? null}
          onWeiter={(k) => oeffneStop(k)}
          onAuswertung={() => {
            setFertigerStop(null);
            setTab("rangliste");
          }}
          onSchliessen={() => setFertigerStop(null)}
        />
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
          spielerName={teilnehmer.find((t) => t.id === aktivId)?.name ?? ""}
          spielerNummer={meineTeilnehmer.filter((t) => hatGewertet(panel.id, t.id)).length + 1}
          spielerGesamt={meineTeilnehmer.length}
          wartetAufAndere={wartetAufAndere}
          wechselHinweis={wechselHinweis}
          onChange={(patch) => speichereErgebnis(panel.id, patch)}
          onAbschliessen={(patch) => wertungAbschliessen(panel.id, patch)}
          onClose={() => {
            setPanel(null);
            setWartetAufAndere(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Übergangskarte nach einem abgeschlossenen Bar-Game: keine Suche auf der
 * Karte, kein Zurücktippen – ein Tipp führt die Gruppe zum nächsten Stop.
 */
function NaechstesGame({
  fertig,
  naechster,
  onWeiter,
  onAuswertung,
  onSchliessen,
}: {
  fertig: TourKneipe;
  naechster: TourKneipe | null;
  onWeiter: (k: TourKneipe) => void;
  onAuswertung: () => void;
  onSchliessen: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1050] px-4 pb-4">
      <div className="kg-slide-up mx-auto max-w-md rounded-2xl border border-bernstein/50 bg-nacht-2 p-4 shadow-2xl space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-moos">Alle durch</p>
            <p className="truncate font-display text-lg">{fertig.name}</p>
          </div>
          <button
            onClick={onSchliessen}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-schaum/60 hover:bg-nacht-3"
            aria-label="schließen"
          >
            <IconX size={18} />
          </button>
        </div>
        {naechster ? (
          <>
            <p className="text-sm text-schaum/60">
              Weiter geht's mit <span className="text-schaum">{naechster.name}</span>.
            </p>
            <Button className="w-full" onClick={() => onWeiter(naechster)}>
              Nächstes Game <IconWeiter size={16} />
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-schaum/60">Das war der letzte Stop – Zeit für die Wertung.</p>
            <Button className="w-full" onClick={onAuswertung}>
              Zur Rangliste <IconWeiter size={16} />
            </Button>
          </>
        )}
      </div>
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

  // Einladungslink mit Zugangscode bauen. Ohne den landet der Eingeladene
  // erst auf der Passwortabfrage, die in der Einladung gar nicht steht –
  // und bricht ab. Klappt der Abruf nicht, bleibt es beim nackten Link.
  useEffect(() => {
    let ab = false;
    const nackt = window.location.href;
    setEinladungsUrl(nackt);
    fetch("/api/einladung")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ab || !d?.z) return;
        const u = new URL(nackt);
        u.searchParams.set("z", d.z as string);
        setEinladungsUrl(u.toString());
      })
      .catch(() => {
        /* Kein Netz – der nackte Link tut es auch, nur mit Codeabfrage. */
      });
    return () => {
      ab = true;
    };
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
      <SeitenKopf titel={tour.name || "Lobby"} />
      <div className="space-y-5 mt-3">
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
          <p className="text-xs text-schaum/55">Scannen zum Beitreten – oder Einladung teilen.</p>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={teilen}>
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
            <p className="text-sm text-schaum/60">Noch niemand dabei.</p>
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
                  <button onClick={() => onWaehleAktiv(t.id)} className="text-xs text-schaum/60 hover:text-bernstein">
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
          <p className="text-center text-sm text-schaum/60">Warten, bis die Gastgeberin die Tour startet…</p>
        )}
      </div>
    </Shell>
  );
}

// ── Scorecard (Stops-Liste als Alternative zur Karte) ────
function Scorecard({
  tour,
  kneipen,
  ergebnisse,
  aktivId,
  challengeFuer,
  onOeffnen,
}: {
  tour: Tour;
  kneipen: TourKneipe[];
  ergebnisse: Ergebnis[];
  aktivId: string | null;
  challengeFuer: (kneipeId: string) => { titel: string; beschreibung: string } | null;
  onOeffnen: (k: TourKneipe) => void;
}) {
  if (!aktivId) {
    return (
      <Card>
        <p className="text-sm text-schaum/60">Wähle oben einen Spieler, um die Scorecard zu sehen.</p>
      </Card>
    );
  }

  const eintraege = kneipen.map((k) => {
    const e = ergebnisse.find((x) => x.tour_kneipe_id === k.id && x.teilnehmer_id === aktivId) ?? null;
    const score = e && e.erledigt ? scoreEintrag(e, tour) : null;
    const verweigert = Boolean(e?.erledigt && (e?.strafschlucke ?? 0) > 0 && (e?.schlucke ?? 0) === 0);
    return { kneipe: k, ergebnis: e, score, verweigert };
  });
  const gesamt = eintraege.reduce((sum, x) => sum + (x.score?.gesamt ?? 0), 0);
  const erledigt = eintraege.filter((x) => x.ergebnis?.erledigt).length;

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl">Scorecard</h2>
        <span className="text-xs text-schaum/60">
          {erledigt}/{kneipen.length} Stops
        </span>
      </div>
      <ol className="space-y-1">
        {eintraege.map(({ kneipe, ergebnis, score, verweigert }, i) => {
          const done = Boolean(ergebnis?.erledigt);
          const challenge = challengeFuer(kneipe.id);
          return (
            <li key={kneipe.id}>
              <button
                onClick={() => onOeffnen(kneipe)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                  done ? "bg-moos/10 border border-moos/30" : "bg-nacht-3 border border-transparent"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`mono grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${
                      done ? "bg-moos/25 text-moos" : "bg-nacht-2 text-schaum/60"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{kneipe.name}</span>
                    {challenge && (
                      <span className="block truncate text-xs text-schaum/55">{challenge.titel}</span>
                    )}
                  </span>
                  {done ? (
                    <span className="text-right">
                      <span className="mono block text-lg leading-tight">{score?.gesamt ?? 0}</span>
                      <span className="block text-[10px] text-schaum/55">
                        {verweigert
                          ? "nicht machbar"
                          : `${ergebnis?.schlucke ?? 0} Schlücke${(score?.straf ?? 0) > 0 ? ` +${score?.straf} Straf` : ""}`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-schaum/55">offen</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between rounded-lg bg-nacht-3 px-3 py-2.5">
        <span className="text-sm text-schaum/70">Gesamt</span>
        <span className="mono text-xl text-bernstein">{gesamt}</span>
      </div>
      <p className="text-xs text-schaum/55">Stop antippen, um die Challenge zu öffnen und zu zählen.</p>
    </Card>
  );
}

// ── Bewertung nach dem Spiel ─────────────────────────────

/**
 * „Welche Kneipen waren top?" – erscheint erst nach dem Beenden der Tour,
 * direkt unter der Endauswertung.
 *
 * Bewusst niedrigschwellig: ein Tipp pro Kneipe, kein Pflichtfeld, keine
 * Sterne, kein Weiter-Knopf. Wer nichts antippt, verliert nichts. Genau
 * deshalb steht es hier und nicht als Zwischenschritt im Ablauf – am Ende
 * eines Abends will niemand ein Formular ausfüllen.
 *
 * Stops ohne `bar_id` (reine Snapshots) fehlen: Ohne Bar in der Bibliothek
 * gäbe es nichts, worauf sich die Empfehlung beziehen könnte.
 */
function KneipenBewertung({
  tourId,
  kneipen,
  userId,
}: {
  tourId: string;
  kneipen: TourKneipe[];
  userId: string;
}) {
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [geladen, setGeladen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const bewertbar = kneipen.filter((k) => k.bar_id);

  useEffect(() => {
    ladeEigeneEmpfehlungen(userId, tourId).then((s) => {
      setGewaehlt(s);
      setGeladen(true);
    });
  }, [userId, tourId]);

  if (!geladen || bewertbar.length === 0) return null;

  async function umschalten(barId: string) {
    const an = !gewaehlt.has(barId);
    setBusy(barId);
    const ok = await empfehlungSetzen(userId, tourId, barId, an);
    setBusy(null);
    if (!ok) return;
    setGewaehlt((prev) => {
      const next = new Set(prev);
      if (an) next.add(barId);
      else next.delete(barId);
      return next;
    });
  }

  return (
    <Card className="mt-4 space-y-3">
      <div>
        <h2 className="font-display text-xl">Welche Kneipen waren top?</h2>
        <p className="text-xs text-schaum/60">
          Ein Tipp genügt. Deine Empfehlung hilft anderen beim Zusammenstellen – wer was empfohlen
          hat, sieht niemand.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {bewertbar.map((k) => {
          const an = gewaehlt.has(k.bar_id as string);
          return (
            <button
              key={k.id}
              onClick={() => umschalten(k.bar_id as string)}
              disabled={busy === k.bar_id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
                an
                  ? "border-bernstein bg-bernstein/15 text-bernstein"
                  : "border-[var(--linie)] bg-nacht-3 text-schaum/70 hover:text-schaum"
              }`}
            >
              <IconFlamme size={13} />
              {k.name}
            </button>
          );
        })}
      </div>
      {gewaehlt.size > 0 && (
        <p className="text-xs text-schaum/55">
          {gewaehlt.size} {gewaehlt.size === 1 ? "Empfehlung" : "Empfehlungen"} gespeichert –
          nochmal antippen nimmt sie zurück.
        </p>
      )}
    </Card>
  );
}

// ── Beitritt bei laufender Tour ───────────────────────
function NachzueglerBeitritt({
  team,
  binDabei,
  standardName,
  onBeitreten,
}: {
  team: boolean;
  /** Spielt dieses Gerät schon mit? Dann geht es nur um weitere Personen darauf. */
  binDabei: boolean;
  standardName?: string;
  onBeitreten: (name: string, alsGeraet: boolean) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState(team || binDabei ? "" : standardName ?? "");

  if (!offen) {
    return (
      <Button variant="ghost" className="w-full" onClick={() => setOffen(true)}>
        {binDabei
          ? team
            ? "Weiteres Team auf diesem Gerät"
            : "Weitere Person auf diesem Gerät"
          : team
            ? "Team tritt noch bei"
            : "Ich spiele mit"}
      </Button>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display text-lg">
          {binDabei
            ? team
              ? "Weiteres Team eintragen"
              : "Weitere Person eintragen"
            : team
              ? "Team eintragen"
              : "Mitspielen"}
        </h2>
        <p className="text-xs text-schaum/60">
          Die Tour läuft schon. Für die verpassten Stops bekommst du jeweils die Punkte des
          Letzten – so entsteht kein Vorteil durchs Zuspätkommen.
        </p>
      </div>
      <Field label={team ? "Team-Name" : binDabei ? "Name" : "Dein Name"}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={team ? "Team-Name" : binDabei ? "Name" : "Dein Name"}
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={!name.trim()}
          onClick={() => {
            // Nur wer selbst noch nicht dabei ist, wird mit dem Konto verknüpft.
            onBeitreten(name, !binDabei);
            setName("");
            setOffen(false);
          }}
        >
          {binDabei ? "Hinzufügen" : "Beitreten"}
        </Button>
        <Button variant="ghost" onClick={() => setOffen(false)}>
          Abbrechen
        </Button>
      </div>
    </Card>
  );
}

// ── Rangliste ────────────────────────────────────────────
function Ranglisten({
  tour,
  teilnehmer,
  ergebnisse,
  aktivId,
  istHost,
  onEntfernen,
}: {
  tour: Tour;
  teilnehmer: Teilnehmer[];
  ergebnisse: Ergebnis[];
  aktivId: string | null;
  istHost?: boolean;
  onEntfernen?: (t: Teilnehmer) => void;
}) {
  const zeilen = rangliste(teilnehmer, ergebnisse, tour);
  const gibtNachgerueckte = zeilen.some((z) => z.nachgeruecktStops > 0);
  const beendet = tour.status === "beendet";
  return (
    <Card className="space-y-3">
      {beendet && zeilen[0] && zeilen[0].erledigt > 0 && (
        <div className="kg-pop rounded-2xl border border-bernstein/40 bg-bernstein/10 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-schaum/60">Sieger</p>
          <p className="flex items-center justify-center gap-2 font-display text-2xl">
            <IconPokal size={20} className="text-bernstein" />
            {zeilen[0].teilnehmer.name}
          </p>
          <p className="mono text-bernstein">{zeilen[0].gesamt} Punkte</p>
        </div>
      )}
      <h2 className="flex items-center gap-2 font-display text-xl">
        {beendet && <IconPokal size={18} className="text-bernstein" />}
        {beendet ? "Endauswertung" : "Rangliste (live)"}
      </h2>
      {zeilen.length === 0 ? (
        <p className="text-sm text-schaum/60">Noch keine Wertungen.</p>
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
                {z.teilnehmer.name}
              </span>
              <span className="text-xs text-schaum/60">
                {z.erledigt} Stops
                {z.nachgeruecktStops > 0 && (
                  <span className="text-schaum/55"> +{z.nachgeruecktStops} n.</span>
                )}
              </span>
              <span className="mono text-lg w-10 text-right">{z.gesamt}</span>
              {istHost && onEntfernen && tour.status !== "beendet" && (
                <button
                  onClick={() => onEntfernen(z.teilnehmer)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ziegel hover:bg-nacht-2"
                  aria-label={`${z.teilnehmer.name} entfernen`}
                  title={`${z.teilnehmer.name} entfernen`}
                >
                  <IconX size={14} />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-schaum/55">Niedrigster Gesamtwert gewinnt (Golf). Inkl. Strafpunkte über Par.</p>
      {gibtNachgerueckte && (
        <p className="text-xs text-schaum/55">
          „+n." = nachgerückte Stops: Wer später dazukam, bekommt dort die Punkte des Letzten.
        </p>
      )}
      {istHost && tour.status !== "beendet" && (
        <p className="text-xs text-schaum/55">
          Als Gastgeber:in kannst du über das ✕ jemanden entfernen, der nicht mehr mitspielt –
          sonst wartet der nächste Stop ewig auf diese Person.
        </p>
      )}
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
  spielerName,
  spielerNummer,
  spielerGesamt,
  wartetAufAndere,
  wechselHinweis,
  onChange,
  onAbschliessen,
  onClose,
}: {
  kneipe: TourKneipe;
  nummer: number;
  challenge: { titel: string; beschreibung: string } | null;
  ergebnis: Ergebnis | null;
  aktiv: boolean;
  verweigerungStrafe: number;
  par: number;
  spielerName: string;
  spielerNummer: number;
  spielerGesamt: number;
  wartetAufAndere: boolean;
  wechselHinweis: string | null;
  onChange: (patch: Partial<Ergebnis>) => void;
  onAbschliessen: (patch: Partial<Ergebnis>) => void;
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
            <p className="text-xs text-schaum/60">Stop {nummer}</p>
            <h2 className="font-display text-xl">{kneipe.name}</h2>
            {kneipe.adresse && <p className="text-sm text-schaum/60">{kneipe.adresse}</p>}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${kneipe.lat},${kneipe.lng}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-bernstein active:brightness-95"
            >
              <IconKompass size={15} /> Hierhin navigieren
            </a>
          </div>
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg text-schaum/60 hover:bg-nacht-3" aria-label="schließen">
            <IconX size={20} />
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
            <p className="text-sm text-schaum/60">Keine Spielform hinterlegt.</p>
          )}
        </div>

        {!aktiv ? (
          <p className="text-sm text-schaum/60 text-center">
            Wähle oben einen Spieler und starte die Tour, um zu werten.
          </p>
        ) : wartetAufAndere ? (
          <div className="space-y-3 rounded-2xl border border-[var(--linie)] bg-nacht-3 p-4 text-center">
            <p className="font-display text-lg">Alle auf diesem Gerät sind durch ✓</p>
            <p className="text-sm text-schaum/60">
              Warten auf die anderen Geräte – sobald alle gewertet haben, geht es automatisch weiter.
            </p>
            <div className="mx-auto h-1.5 w-24 overflow-hidden rounded-full bg-nacht-2">
              <div className="h-full w-1/3 animate-pulse bg-bernstein" />
            </div>
            <button onClick={onClose} className="text-sm text-schaum/60 hover:text-bernstein">
              Fenster schließen
            </button>
          </div>
        ) : (
          <>
            {/* Wer ist dran – der Wechsel passiert automatisch nach dem Eintrag */}
            <div className="flex items-center justify-between rounded-2xl border border-bernstein/40 bg-bernstein/10 px-4 py-2.5">
              <span className="min-w-0">
                <span className="block text-xs text-schaum/60">Jetzt dran</span>
                <span className="block truncate font-display text-lg">{spielerName}</span>
              </span>
              {spielerGesamt > 1 && (
                <span className="mono shrink-0 text-sm text-schaum/60">
                  {Math.min(spielerNummer, spielerGesamt)}/{spielerGesamt}
                </span>
              )}
            </div>

            {wechselHinweis && (
              <p className="kg-pop text-center text-sm text-moos">
                Gewertet – weiter mit {wechselHinweis}
              </p>
            )}

            <div className="flex items-center justify-between rounded-2xl bg-nacht-3 border border-[var(--linie)] p-4">
              <span className="text-sm text-schaum/70">Schlücke</span>
              <div className="flex items-center gap-4">
                <button
                  className="h-14 w-14 rounded-full bg-nacht-2 border border-[var(--linie)] text-xl"
                  onClick={() => onChange({ schlucke: Math.max(0, schlucke - 1), strafschlucke: 0 })}
                >
                  –
                </button>
                <span className="mono text-2xl w-8 text-center">{schlucke}</span>
                <button
                  className="h-14 w-14 rounded-full bg-bernstein text-tinte text-xl"
                  onClick={() => onChange({ schlucke: schlucke + 1, strafschlucke: 0 })}
                >
                  +
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-schaum/60">
              {schlucke === par
                ? "genau Par"
                : schlucke > par
                  ? `${schlucke - par} über Par`
                  : `${par - schlucke} unter Par`}
            </p>

            <Button
              className="w-full"
              onClick={() =>
                erledigt ? onChange({ erledigt: false }) : onAbschliessen({ strafschlucke: 0 })
              }
              variant={erledigt ? "ghost" : "primary"}
            >
              {erledigt
                ? "Erledigt ✓ (tippen zum Zurücknehmen)"
                : spielerGesamt > 1
                  ? "Eintragen & weitergeben"
                  : "Als erledigt markieren"}
            </Button>

            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Challenge als „nicht machbar" werten? Das gibt +${verweigerungStrafe} Strafschlücke.`
                  )
                ) {
                  onAbschliessen({ schlucke: 0, strafschlucke: verweigerungStrafe });
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
