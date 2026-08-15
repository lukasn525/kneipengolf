"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { SeitenKopf } from "@/components/SeitenKopf";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import { tourCode, stopsText } from "@/lib/game";
import { GlasIcon } from "@/components/GlasIcon";
import { GLAESER } from "@/lib/glas";
import { AdressSuche, type GeoTreffer } from "@/components/AdressSuche";
import { holeRoute, reverseGeocode } from "@/lib/nav";
import { getStandardModus } from "@/lib/einstellungen";
import {
  IconHoch,
  IconRunter,
  IconX,
  IconStift,
  IconPin,
  IconGlobus,
  IconSchloss,
  IconRoute,
  IconUebernommen,
  IconPlus,
  IconFlamme,
  IconHaken,
} from "@/components/Icons";
import {
  barAnlegen,
  ladeBars,
  ladeSpielformen,
  spielformAnlegen,
  spielformLoeschen,
  type BarListe,
} from "@/lib/ugc";
import { erkenneStadt } from "@/lib/orte";
import {
  beliebtheitText,
  ladeBeliebtheit,
  leereBeliebtheit,
  nachBeliebtheit,
  stufe,
  type BeliebtheitMap,
} from "@/lib/beliebtheit";
import {
  freierRoutenName,
  ladeRoute,
  ladeRouten,
  routeAktualisieren,
  routeSpeichern,
  type RouteMitStops,
  type RoutenListe,
} from "@/lib/routen";
import type { Bar, GlasTyp, SpielModus, Stadt } from "@/lib/types";

type Stop = {
  name: string;
  lat: number;
  lng: number;
  adresse: string | null;
  /** Referenz in die Bar-Bibliothek; der Stop selbst bleibt ein Snapshot */
  barId?: string;
};

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-schaum/55">Karte lädt…</div>
  ),
});

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useSession();

  /**
   * Zwei Modi auf einer Seite – bewusst, weil beide dieselbe Stopliste,
   * dieselbe Karte und denselben Bar-Picker brauchen:
   *   • Spiel-Modus (Standard): Route zusammenstellen und sofort spielen.
   *   • Routen-Modus (?modus=route): nur Stadt, Bars und Name – speichern.
   */
  const modusRoute = params.get("modus") === "route";

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
    { lat: number; lng: number; name: string; adresse: string | null; ort: string | null } | null
  >(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const routeReqId = useRef(0); // stellt sicher, dass nur die neueste Route greift

  // Bar-Bibliothek (kuratiert / Community / eigene) + persönliche Ausblendungen
  const [barListe, setBarListe] = useState<BarListe | null>(null);
  const [beliebt, setBeliebt] = useState<BeliebtheitMap>(leereBeliebtheit);
  const [pickerOffen, setPickerOffen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"liste" | "selbst">("liste");

  /**
   * Schritt im Ablauf „Neues Spiel": 1 Route · 2 Regeln · 3 Übersicht.
   *
   * Gilt nur fürs Spielerstellen. Der Routen-Modus (`modusRoute`) bleibt
   * bewusst eine einzelne Seite – dort gibt es keine Regeln, ein Ablauf mit
   * Schritten wäre nur Umweg.
   *
   * Schritt 2 ist vollständig vorbelegt und überspringbar: wer zum ersten
   * Mal spielt, soll keine Golf-Wertung konfigurieren müssen.
   */
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1);
  const [erweitertOffen, setErweitertOffen] = useState(false);

  // Routen: laden (eigene / Community) und die aktuelle Stopliste sichern
  const [routenListe, setRoutenListe] = useState<RoutenListe | null>(null);
  const [routePickerOffen, setRoutePickerOffen] = useState(false);
  const [geladeneRoute, setGeladeneRoute] = useState<RouteMitStops | null>(null);
  const [routeFormOffen, setRouteFormOffen] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeBesch, setRouteBesch] = useState("");
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeMeldung, setRouteMeldung] = useState<string | null>(null);

  // Spielformen: an-/abwählbar; eigene werden dauerhaft am Konto gespeichert
  const [spielformAuswahl, setSpielformAuswahl] = useState<
    {
      id: number;
      titel: string;
      beschreibung: string;
      aktiv: boolean;
      eigen: boolean;
    }[]
  >([]);
  const [sfTitel, setSfTitel] = useState("");
  const [sfBesch, setSfBesch] = useState("");
  const [sfFormOffen, setSfFormOffen] = useState(false);

  const stadt = useMemo(() => staedte.find((s) => s.id === stadtId) ?? null, [staedte, stadtId]);
  // Auch aktiv, wenn eine gespeicherte Route geladen wurde, bevor die
  // Städteliste da war – sonst blinkt die Route kurz weg.
  const aktiv = Boolean(stadt) || eigenerModus || stops.length > 0;

  /** Automatisch erkannte Stadt für den gerade gesetzten Pin. */
  const pendingStadt = useMemo(
    () =>
      pending
        ? erkenneStadt(staedte, { ort: pending.ort, lat: pending.lat, lng: pending.lng })
        : null,
    [pending, staedte]
  );

  /** Namen der eigenen Routen – Grundlage für die Eindeutigkeitsprüfung. */
  const meineRoutenNamen = useMemo(
    () => (routenListe?.eigene ?? []).map((r) => r.name),
    [routenListe]
  );
  /** Beim Aktualisieren zählt der eigene alte Name nicht als Konflikt. */
  const eigeneRoute =
    geladeneRoute && geladeneRoute.ersteller_user_id === user?.id ? geladeneRoute : null;
  const namenOhneEigenen = meineRoutenNamen.filter((n) => n !== eigeneRoute?.name);
  const routeNameKonflikt =
    routeName.trim().length > 0 &&
    namenOhneEigenen.some((n) => n.trim().toLowerCase() === routeName.trim().toLowerCase());

  // Was steht im Picker zur Auswahl? Ausgeblendete und bereits gesetzte Bars fliegen raus.
  // Sortiert nach Beliebtheit: Vorschläge, die andere schon gut fanden, stehen oben.
  const frei = (b: Bar) => !stops.some((s) => s.barId === b.id) && !barListe?.ausgeblendet.has(b.id);
  const verfuegbareKuratiert = nachBeliebtheit((barListe?.kuratiert ?? []).filter(frei), beliebt);
  const verfuegbareCommunity = nachBeliebtheit((barListe?.community ?? []).filter(frei), beliebt);
  const verfuegbareEigene = (barListe?.eigene ?? []).filter(frei);
  const verfuegbareGesamt =
    verfuegbareKuratiert.length + verfuegbareCommunity.length + verfuegbareEigene.length;
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
    supabase()
      .from("staedte")
      .select("*")
      .order("name")
      .then(({ data }) => setStaedte((data as Stadt[]) ?? []));
    setSpielModus(getStandardModus()); // Voreinstellung aus den Einstellungen
  }, []);

  // Spielformen laden: global + Community + eigene. Im Hauptmenü ausgeblendete
  // Spiele starten hier abgewählt – die Entscheidung dort gilt also weiter.
  useEffect(() => {
    if (!user) return;
    ladeSpielformen(user.id).then((l) => {
      const alle = [...l.global, ...l.community, ...l.eigene];
      setSpielformAuswahl(
        alle.map((s) => ({
          id: s.id,
          titel: s.titel,
          beschreibung: s.beschreibung,
          aktiv: !l.ausgeblendet.has(s.id),
          eigen: s.ersteller_user_id === user.id,
        }))
      );
    });
  }, [user]);

  // Eigene Bars sind auch ohne gewählte Stadt sofort verfügbar
  useEffect(() => {
    if (!user || stadtId) return;
    ladeBars(user.id).then(setBarListe);
  }, [user, stadtId]);

  // Gespeicherte Routen laden (eigene + öffentliche der Community)
  useEffect(() => {
    if (!user) return;
    ladeRouten(user.id).then(setRoutenListe);
  }, [user]);

  // Beliebtheit nachladen, sobald die Bars da sind – sie sortiert nur den
  // Picker und darf den Seitenaufbau nicht aufhalten.
  useEffect(() => {
    if (!barListe) return;
    const ids = [...barListe.kuratiert, ...barListe.community, ...barListe.eigene].map((b) => b.id);
    ladeBeliebtheit(ids).then(setBeliebt);
  }, [barListe]);

  // Schnellstart aus dem Hauptmenü: /create?route=<id>
  useEffect(() => {
    const id = params.get("route");
    if (!id || !user || geladeneRoute) return;
    ladeRoute(id).then((r) => {
      if (r) routeInsFormular(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, user]);

  useEffect(() => {
    if (!routeMeldung) return;
    const t = setTimeout(() => setRouteMeldung(null), 3500);
    return () => clearTimeout(t);
  }, [routeMeldung]);

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

  const stopAus = (b: Bar): Stop => ({
    barId: b.id,
    name: b.name,
    lat: b.lat,
    lng: b.lng,
    adresse: b.adresse,
  });

  async function stadtWaehlen(id: number) {
    setEigenerModus(false);
    setStadtId(id);
    setGeladeneRoute(null); // Standardvorschlag ist keine gespeicherte Route mehr
    setRouteFormOffen(false);
    const liste = await ladeBars(user?.id, id);
    setBarListe(liste);
    setStops(await standardStops(liste, id));
  }

  /**
   * Vorschlag beim Wählen einer Stadt: die 9 beliebtesten Bars dieser Stadt,
   * 9 Stops wie 9 Golf-Löcher.
   *
   * Bewusst aus ALLEN sichtbaren Bars der Stadt – kuratierte, öffentliche aus
   * der Community und eigene gleichberechtigt. Vorher zog der Vorschlag nur
   * aus `kuratiert`, also nur aus den vom Team angelegten Bars: in Bonn kamen
   * so 8 statt 9 Stops heraus, weil zwei der zehn Bonner Bars selbst angelegt
   * waren und stillschweigend übersprungen wurden.
   *
   * `ladeBars` liefert eigene Bars unabhängig von der Stadt (damit sie in der
   * Bibliothek immer auftauchen) – für den Vorschlag muss deshalb auf die
   * gewählte Stadt gefiltert werden, sonst landet die Hamburger Stammkneipe
   * in einer Bonner Runde.
   *
   * Persönlich ausgeblendete Bars kommen gar nicht erst in Frage.
   */
  async function standardStops(liste: BarListe, id: number): Promise<Stop[]> {
    const auswahl = [...liste.kuratiert, ...liste.community, ...liste.eigene].filter(
      (b) => b.stadt_id === id && !liste.ausgeblendet.has(b.id)
    );
    const werte = await ladeBeliebtheit(auswahl.map((b) => b.id));
    return nachBeliebtheit(auswahl, werte).slice(0, 9).map(stopAus);
  }

  async function eigeneStadtWaehlen() {
    setEigenerModus(true);
    setStadtId(null);
    setStops([]);
    setGeladeneRoute(null);
    setRouteFormOffen(false);
    setBarListe(await ladeBars(user?.id));
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
    setPending({ lat, lng, name: "", adresse: null, ort: null });
    setPendingBusy(true);
    const rev = await reverseGeocode(lat, lng);
    setPending((p) =>
      p
        ? {
            ...p,
            name: p.name || (rev?.name ?? ""),
            adresse: rev?.label ?? p.adresse,
            ort: rev?.ort ?? p.ort,
          }
        : p
    );
    setPendingBusy(false);
  }
  function ausSucheWaehlen(t: GeoTreffer) {
    setPending({ lat: t.lat, lng: t.lng, name: t.name, adresse: t.label, ort: t.ort ?? null });
    setFlyTo([t.lat, t.lng]);
  }
  async function pendingBewegt(lat: number, lng: number) {
    setPending((p) => (p ? { ...p, lat, lng } : p));
    setPendingBusy(true);
    const rev = await reverseGeocode(lat, lng);
    setPending((p) => (p ? { ...p, adresse: rev?.label ?? p.adresse, ort: rev?.ort ?? p.ort } : p));
    setPendingBusy(false);
  }
  /**
   * Bestätigt den Vorschau-Pin. Die Bar wird dabei IMMER dauerhaft in der
   * Bibliothek gespeichert – und zwar privat. Das ist die „Routen-Ausnahme":
   * hier entstandene Bars werden nie automatisch veröffentlicht, das geht
   * nur bewusst im Hauptmenü unter „Bars".
   */
  async function pendingBestaetigen() {
    if (!pending || !pending.name.trim() || !user) return;
    setPendingBusy(true);
    const bar = await barAnlegen(user.id, {
      name: pending.name,
      lat: pending.lat,
      lng: pending.lng,
      adresse: pending.adresse,
      // Ohne gewählte Stadt (eigene Route) die Stadt aus der Adresse ableiten
      stadt_id: stadt?.id ?? pendingStadt?.stadt.id ?? null,
    });
    setPendingBusy(false);
    if (!bar) {
      setFehler("Bar konnte nicht gespeichert werden – nochmal versuchen?");
      return;
    }
    setBarListe((prev) =>
      prev
        ? { ...prev, eigene: [...prev.eigene, bar] }
        : { kuratiert: [], community: [], eigene: [bar], ausgeblendet: new Set<string>() }
    );
    setStops((prev) => [...prev, stopAus(bar)]);
    setPending(null);
  }
  function pendingVerwerfen() {
    setPending(null);
  }

  function barHinzufuegen(b: Bar) {
    setStops((prev) => [...prev, stopAus(b)]);
  }

  function openPicker() {
    setPending(null);
    setPickerTab(verfuegbareGesamt > 0 ? "liste" : "selbst");
    setPickerOffen(true);
  }

  // ── Routen ──────────────────────────────────────────────────────

  /**
   * Übernimmt eine gespeicherte Route in das Formular. Die Stops sind
   * Snapshots, `bar_id` bleibt erhalten – dadurch landet in der Tour
   * wieder die Referenz und Mitspieler sehen auch private Bars.
   */
  async function routeInsFormular(r: RouteMitStops) {
    setRoutePickerOffen(false);
    setPending(null);
    if (r.stadt_id) {
      setStadtId(r.stadt_id);
      setEigenerModus(false);
    } else {
      setStadtId(null);
      setEigenerModus(true);
    }
    setStops(
      r.stops.map((s) => ({
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        adresse: s.adresse,
        barId: s.bar_id ?? undefined,
      }))
    );
    setGeladeneRoute(r);
    setName((n) => n || r.name);
    // Namensfeld gleich mitfüllen: bei eigenen Routen der echte Name
    // (Überschreiben), bei fremden ein freier Vorschlag (Kopie).
    setRouteName(
      r.ersteller_user_id === user?.id ? r.name : freierRoutenName(r.name, meineRoutenNamen)
    );
    setRouteBesch(r.beschreibung ?? "");
    setBarListe(await ladeBars(user?.id, r.stadt_id ?? undefined));
    setRouteMeldung(`Route „${r.name}" geladen – ${stopsText(r.stops.length)}.`);
  }

  /** Öffnet das Speichern-Formular mit einem freien Namensvorschlag. */
  function routeFormOeffnen() {
    if (!routeName.trim()) {
      const basis = name.trim() || stadt?.name || "Meine Route";
      setRouteName(freierRoutenName(basis, meineRoutenNamen));
    }
    setRouteBesch((b) => b || geladeneRoute?.beschreibung || "");
    setRouteFormOffen(true);
  }

  const stopsFuerRoute = () =>
    stops.map((s) => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      adresse: s.adresse,
      barId: s.barId ?? null,
    }));

  const routeSpeicherbar =
    Boolean(user) && stops.length > 0 && routeName.trim().length > 0 && !routeNameKonflikt;

  /**
   * Ein Weg für alle Speicher-Varianten: neu anlegen oder die geladene
   * eigene Route überschreiben, danach hier bleiben, zur Routenliste
   * springen oder direkt in die Spielerstellung wechseln.
   */
  async function routeSichern(
    alsNeu: boolean,
    danach: "bleiben" | "routen" | "spiel" = "bleiben"
  ) {
    if (!user || !routeSpeicherbar) return;
    const daten = { name: routeName, beschreibung: routeBesch, stadtId: stadt?.id ?? null };
    setRouteBusy(true);
    const res =
      !alsNeu && eigeneRoute
        ? await routeAktualisieren(eigeneRoute.id, daten, stopsFuerRoute())
        : await routeSpeichern(user.id, daten, stopsFuerRoute());
    setRouteBusy(false);
    if (!res.ok) {
      setRouteMeldung(res.meldung);
      return;
    }

    if (danach === "routen") {
      router.push("/dashboard?tab=routen");
      return;
    }
    if (danach === "spiel") {
      // Modus wechseln: dieselbe Route, aber jetzt mit Spieleinstellungen
      router.replace(`/create?route=${res.route.id}`);
      return;
    }

    const liste = await ladeRouten(user.id);
    setRoutenListe(liste);
    setGeladeneRoute(liste.eigene.find((r) => r.id === res.route.id) ?? null);
    setRouteFormOffen(false);
    setRouteMeldung(
      alsNeu || !eigeneRoute
        ? `„${res.route.name}" liegt jetzt unter „Routen" im Hauptmenü.`
        : `„${res.route.name}" aktualisiert.`
    );
  }

  function toggleSpielform(id: number) {
    setSpielformAuswahl((prev) => prev.map((s) => (s.id === id ? { ...s, aktiv: !s.aktiv } : s)));
  }
  async function eigeneSpielformHinzufuegen() {
    if (!sfTitel.trim()) return;
    const titel = sfTitel.trim();
    const beschreibung = sfBesch.trim();
    if (!user) return;
    // Eigene Spielformen landen dauerhaft am Konto (privat) – nicht pro Tour neu tippen.
    const sf = await spielformAnlegen(user.id, titel, beschreibung);
    if (!sf) {
      setFehler("Spielform konnte nicht gespeichert werden.");
      return;
    }
    setSpielformAuswahl((prev) => [
      ...prev,
      { id: sf.id, titel: sf.titel, beschreibung: sf.beschreibung, aktiv: true, eigen: true },
    ]);
    setSfTitel("");
    setSfBesch("");
    setSfFormOffen(false);
  }
  async function eigeneSpielformEntfernen(id: number) {
    const eintrag = spielformAuswahl.find((s) => s.id === id);
    if (!eintrag) return;
    if (!window.confirm(`„${eintrag.titel}" dauerhaft aus deinen Spielen löschen?`)) return;
    await spielformLoeschen(id);
    setSpielformAuswahl((prev) => prev.filter((s) => s.id !== id));
  }

  async function erstellen() {
    // Früher ein stiller `return`: der Knopf tat dann einfach nichts. In
    // Schritt 3 ist man weit weg von der Ursache – also sagen, was fehlt.
    if (!user) {
      setFehler("Deine Anmeldung ist abgelaufen. Bitte lade die Seite neu.");
      return;
    }
    if (stops.length === 0 || (!stadt && !eigenerModus)) {
      setFehler("Die Route hat noch keine Stops – geh zurück zu Schritt 1.");
      return;
    }
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
          // Herkunft festhalten – „Nochmal spielen" zeigt nur Routen,
          // aus denen tatsächlich eine gespielte Tour entstanden ist.
          route_id: geladeneRoute?.id ?? null,
        })
        .select()
        .single();
      if (e1 || !tour) throw e1 ?? new Error("Tour konnte nicht erstellt werden.");

      // Stops sind Snapshots (Name/Koordinaten) + Referenz auf die Bar.
      // Dadurch bleiben Touren intakt, selbst wenn die Bar später gelöscht wird,
      // und Mitspieler dürfen private Bars der Session lesen.
      const rows = stops.map((s, i) => ({
        tour_id: tour.id,
        bar_id: s.barId ?? null,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        adresse: s.adresse,
        position: i,
      }));
      const { data: kneipen, error: e2 } = await sb.from("tour_kneipen").insert(rows).select();
      if (e2 || !kneipen) throw e2 ?? new Error("Bars konnten nicht gespeichert werden.");

      // Pro Bar einmalig eine aktive Spielform ziehen und als Snapshot speichern
      // (Titel + Beschreibung), damit auch eigene Spielformen funktionieren.
      const ch = kneipen.map((k: any) => {
        const s = aktiveSpielformen[Math.floor(Math.random() * aktiveSpielformen.length)];
        return {
          tour_id: tour.id,
          tour_kneipe_id: k.id,
          spielform_id: s.id,
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
      <SeitenKopf
        titel={
          modusRoute
            ? eigeneRoute
              ? "Route bearbeiten"
              : "Route erstellen"
            : schritt === 1
              ? "Route"
              : schritt === 2
                ? "Regeln"
                : "Übersicht"
        }
        zurueckZu={modusRoute ? "/dashboard?tab=routen" : "/dashboard"}
        zurueckLabel={!modusRoute && schritt > 1 ? "Schritt zurück" : "Zurück"}
        onZurueck={
          !modusRoute && schritt > 1
            ? () => setSchritt((v) => (v === 3 ? 2 : 1))
            : undefined
        }
      />

      {/* Fortschritt – nur im Spiel-Ablauf, nicht beim Routenbauen. */}
      {!modusRoute && (
        <div className="flex items-center gap-2 pt-3">
          {([1, 2, 3] as const).map((n, i) => {
            const erledigt = schritt > n;
            const aktivS = schritt === n;
            return (
              <div key={n} className="flex flex-1 items-center gap-2">
                <button
                  onClick={() => erledigt && setSchritt(n)}
                  disabled={!erledigt}
                  className={`flex min-h-[44px] items-center gap-2 text-xs ${
                    aktivS ? "text-schaum" : erledigt ? "text-schaum/70" : "text-schaum/45"
                  }`}
                >
                  <span
                    className={`mono grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] ${
                      aktivS
                        ? "border-bernstein bg-bernstein text-tinte"
                        : erledigt
                          ? "border-moos text-moos"
                          : "border-[var(--linie)]"
                    }`}
                  >
                    {erledigt ? "\u2713" : n}
                  </span>
                  {["Route", "Regeln", "Übersicht"][i]}
                </button>
                {n < 3 && <span className="h-px flex-1 bg-[var(--linie)]" />}
              </div>
            );
          })}
        </div>
      )}
      <div className={`space-y-5 mt-3 ${modusRoute ? "pb-44" : "pb-24"}`}>
        <div>
          {modusRoute && (
            <p className="mt-1 text-sm text-schaum/60">
              Stadt wählen, Bars zusammenstellen, Namen vergeben. Gespielt wird später – mit einem
              Tipp aus der Routenliste.
            </p>
          )}
        </div>

        {(modusRoute || schritt === 1) && (
        <>
        <Card className="space-y-3">
          {modusRoute ? (
            <>
              <Field label="Name der Route">
                <Input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="z. B. Südstadt-Runde"
                />
              </Field>
              {routeNameKonflikt && (
                <button
                  onClick={() => setRouteName(freierRoutenName(routeName, namenOhneEigenen))}
                  className="text-left text-xs text-ziegel underline"
                >
                  Diesen Namen hast du schon – „{freierRoutenName(routeName, namenOhneEigenen)}"
                  nehmen?
                </button>
              )}
              <Field label="Beschreibung (optional)">
                <Input
                  value={routeBesch}
                  onChange={(e) => setRouteBesch(e.target.value)}
                  placeholder="Kurz: für wen oder wofür?"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Name des Spiels (optional)">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Geburtstags-Tour"
                />
              </Field>
              <Field label="Modus">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-nacht-3 p-1">
                  {(["einzel", "team"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSpielModus(m)}
                      className={`min-h-[44px] rounded-lg py-2 text-sm font-semibold transition ${
                        spielModus === m ? "bg-bernstein text-tinte" : "text-schaum/70"
                      }`}
                    >
                      {m === "einzel" ? "Einzelspieler" : "Team"}
                    </button>
                  ))}
                </div>
              </Field>
              <p className="text-xs text-schaum/60">
                {spielModus === "team"
                  ? "Team-Modus: Jedes Gerät spielt als ein Team (Pass-and-Play im Team), die Rangliste vergleicht Teams."
                  : "Einzelspieler: jede Person wertet für sich."}
              </p>
            </>
          )}
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
                <p className="text-sm text-schaum/60 col-span-2">
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
                <span className="inline-flex items-center gap-2">
                  <IconStift size={15} /> Eigene Stadt / Route
                </span>
              </button>
            </div>
          </Field>

          {/* Der kürzeste Weg zum Spiel: eine fertige Route nehmen. */}
          {routenListe && routenListe.eigene.length + routenListe.community.length > 0 && (
            <button
              onClick={() => setRoutePickerOffen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-[var(--linie)] bg-nacht-2 px-4 py-3 text-left transition hover:bg-nacht-3"
            >
              <IconRoute size={17} className="shrink-0 text-bernstein" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Gespeicherte Route laden</span>
                <span className="block text-xs text-schaum/60">
                  {routenListe.eigene.length} eigene · {routenListe.community.length} aus der
                  Community
                </span>
              </span>
            </button>
          )}
        </Card>

        {aktiv && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Route ({stopsText(stops.length)})</h2>
              {geladeneRoute && (
                <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-bernstein/15 px-2 py-0.5 text-[11px] text-bernstein">
                  <IconRoute size={11} className="shrink-0" />
                  <span className="truncate">{geladeneRoute.name}</span>
                </span>
              )}
            </div>
            {routeMeldung && (
              <p className="kg-pop rounded-xl border border-bernstein/40 bg-bernstein/10 px-3 py-2 text-sm">
                {routeMeldung}
              </p>
            )}
            {/*
              Neun ist der Vorschlag, keine Bedingung: gespielt werden kann mit
              jeder Zahl ab einem Stop. Hat die Stadt weniger als neun Bars,
              sagt der Text das nüchtern – ohne zum Nachlegen aufzufordern.
            */}
            <p className="text-sm text-schaum/60">
              {stops.length < 9
                ? `Alle ${stopsText(stops.length)} dieser Stadt sind vorgeschlagen – mit weniger als neun spielt es sich genauso.`
                : "Vorgeschlagen sind die 9 beliebtesten Bars der Stadt."}{" "}
              Reihenfolge anpassen, entfernen – oder über „Bar hinzufügen" ergänzen.
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
                  flyTo={flyTo}
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
                    <button
                      onClick={() => setFlyTo([s.lat, s.lng])}
                      className="flex-1 min-w-0 text-left"
                      title="Auf der Karte zeigen"
                    >
                      <span className="block truncate">{s.name}</span>
                      {s.adresse && <span className="block text-xs text-schaum/60 truncate">{s.adresse}</span>}
                    </button>
                    <button onClick={() => move(i, -1)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-schaum/70 hover:bg-nacht-2" aria-label="hoch">
                      <IconHoch />
                    </button>
                    <button onClick={() => move(i, 1)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-schaum/70 hover:bg-nacht-2" aria-label="runter">
                      <IconRunter />
                    </button>
                    <button onClick={() => entfernen(i)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ziegel hover:bg-nacht-2" aria-label="entfernen">
                      <IconX />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Button variant="ghost" className="w-full" onClick={openPicker}>
              + Bar hinzufügen
            </Button>

            {/*
              Route sichern – im Routen-Modus übernimmt das die feste
              Leiste unten, hier bleibt die Karte dann bewusst ruhig.
            */}
            {!modusRoute &&
              stops.length > 0 &&
              (routeFormOffen ? (
                <div className="space-y-2 rounded-xl border border-bernstein/40 bg-nacht-3 p-3">
                  <Field label="Name der Route">
                    <Input
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      placeholder="z. B. Südstadt-Runde"
                    />
                  </Field>
                  {routeNameKonflikt && (
                    <button
                      onClick={() => setRouteName(freierRoutenName(routeName, namenOhneEigenen))}
                      className="text-left text-xs text-ziegel underline"
                    >
                      Diesen Namen hast du schon – „
                      {freierRoutenName(routeName, namenOhneEigenen)}" nehmen?
                    </button>
                  )}
                  <Field label="Beschreibung (optional)">
                    <Input
                      value={routeBesch}
                      onChange={(e) => setRouteBesch(e.target.value)}
                      placeholder="Kurz: für wen oder wofür?"
                    />
                  </Field>
                  <p className="flex items-center gap-1.5 text-xs text-schaum/60">
                    <IconSchloss size={13} className="shrink-0" />
                    Wird privat gespeichert. Teilen und Veröffentlichen geht danach im Hauptmenü
                    unter „Routen".
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {eigeneRoute && (
                      <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={() => routeSichern(false)}
                        disabled={routeBusy || !routeSpeicherbar}
                      >
                        {routeBusy ? "…" : `„${eigeneRoute.name}" aktualisieren`}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => routeSichern(true)}
                      disabled={routeBusy || !routeSpeicherbar}
                    >
                      {routeBusy ? "…" : eigeneRoute ? "Als neue Route" : "Route speichern"}
                    </Button>
                    <Button variant="ghost" onClick={() => setRouteFormOffen(false)}>
                      <IconX size={16} />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" className="w-full" onClick={routeFormOeffnen}>
                  <IconRoute size={16} />
                  {eigeneRoute ? "Route aktualisieren" : "Diese Route speichern"}
                </Button>
              ))}
          </Card>
        )}
        </>
        )}

        {/* Par, Glas und Spielformen gehören zum Abend, nicht zur Vorlage. */}
        {aktiv && !modusRoute && schritt === 2 && (
          <Card className="space-y-2 border-moos/40">
            <div className="flex items-start gap-2.5">
              <IconHaken size={18} className="mt-0.5 shrink-0 text-moos" />
              <div>
                <h2 className="font-display text-lg">Alles vorbelegt</h2>
                <p className="text-sm text-schaum/60">
                  Par {par}, {strafeAktiv ? "Strafpunkte an" : "keine Strafpunkte"},{" "}
                  {spielformAuswahl.filter((s) => s.aktiv).length} Spielformen. Du kannst direkt
                  weiter – ändern kannst du das hier, wenn du magst.
                </p>
              </div>
            </div>
          </Card>
        )}

        {aktiv && !modusRoute && schritt === 2 && (
          <Card className="space-y-3">
            <button
              type="button"
              onClick={() => setErweitertOffen((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-display text-xl">Erweiterte Einstellungen</span>
              <span className="text-schaum/60">{erweitertOffen ? <IconHoch /> : <IconRunter />}</span>
            </button>

            {!erweitertOffen ? (
              <p className="text-xs text-schaum/60">
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
                    <span className="text-xs text-schaum/60">
                      {spielformAuswahl.filter((s) => s.aktiv).length} aktiv
                    </span>
                  </div>
                  <p className="text-sm text-schaum/60">
                    Tippe an, um Spielformen ins Spiel zu nehmen oder rauszunehmen.
                  </p>
                  <div className="space-y-1.5">
                    {spielformAuswahl.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
                          s.aktiv ? "border-bernstein/50 bg-nacht-3" : "border-[var(--linie)] bg-nacht-2"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSpielform(s.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className={`block text-sm font-semibold ${s.aktiv ? "" : "text-schaum/60"}`}>
                            {s.titel}
                          </span>
                          {s.beschreibung && (
                            <span className="block text-xs text-schaum/60">{s.beschreibung}</span>
                          )}
                        </button>
                        <div className="flex shrink-0 items-center gap-2 pt-0.5">
                          {s.eigen && (
                            <button
                              type="button"
                              onClick={() => eigeneSpielformEntfernen(s.id)}
                              className="text-ziegel"
                              aria-label="entfernen"
                            >
                              <IconX size={16} />
                            </button>
                          )}
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${
                              s.aktiv
                                ? "border-bernstein bg-bernstein text-tinte"
                                : "border-[var(--linie)] text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                      </div>
                    ))}
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
                      <p className="flex items-center gap-1.5 text-xs text-schaum/60">
                        <IconSchloss size={13} className="shrink-0" />
                        Wird privat in „Meine Spiele" gespeichert.
                      </p>
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

        {/* ── Schritt 3: Übersicht ────────────────────────────────── */}
        {aktiv && !modusRoute && schritt === 3 && (
          <Card className="space-y-3">
            <h2 className="font-display text-xl">Alles bereit?</h2>
            <ul className="divide-y divide-[var(--linie)] text-sm">
              <li className="flex items-center justify-between py-2.5">
                <span className="text-schaum/60">Stadt</span>
                <span>{stadt ? stadt.name : "eigene Auswahl"}</span>
              </li>
              <li className="flex items-center justify-between py-2.5">
                <span className="text-schaum/60">Route</span>
                <span className="mono">{stopsText(stops.length)}</span>
              </li>
              <li className="flex items-center justify-between py-2.5">
                <span className="text-schaum/60">Par pro Stop</span>
                <span className="mono">{par}</span>
              </li>
              <li className="flex items-center justify-between py-2.5">
                <span className="text-schaum/60">Strafpunkte</span>
                <span>{strafeAktiv ? `an · ${strafeProSchluck} pro Schluck über Par` : "aus"}</span>
              </li>
              <li className="flex items-center justify-between py-2.5">
                <span className="text-schaum/60">Spielformen</span>
                <span className="mono">{spielformAuswahl.filter((s) => s.aktiv).length}</span>
              </li>
              <li className="flex items-center justify-between py-2.5">
                <span className="text-schaum/60">Modus</span>
                <span>{spielModus === "team" ? "Team" : "Einzelspieler"}</span>
              </li>
            </ul>
            <p className="text-xs text-schaum/60">
              Nach dem Erstellen bekommst du Code und QR zum Teilen – Mitspieler können bis zum
              Start und auch danach noch dazukommen.
            </p>
          </Card>
        )}

        {fehler && <p className="text-sm text-ziegel">{fehler}</p>}
      </div>

      {aktiv && stops.length > 0 && !pickerOffen && !routePickerOffen && (
        <div className="fixed inset-x-0 bottom-0 z-[1100] border-t border-[var(--linie)] bg-nacht p-4">
          <div className="mx-auto max-w-md space-y-2">
            {modusRoute ? (
              <>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => routeSichern(false, "routen")}
                    disabled={routeBusy || !routeSpeicherbar}
                  >
                    {routeBusy
                      ? "speichere…"
                      : eigeneRoute
                        ? "Änderungen speichern"
                        : `Route speichern · ${stopsText(stops.length)}`}
                  </Button>
                  {eigeneRoute && (
                    <Button
                      variant="ghost"
                      onClick={() => routeSichern(true, "routen")}
                      disabled={routeBusy || !routeSpeicherbar}
                      title="Als neue Route speichern"
                    >
                      <IconPlus size={16} />
                    </Button>
                  )}
                </div>
                <button
                  onClick={() => routeSichern(!eigeneRoute, "spiel")}
                  disabled={routeBusy || !routeSpeicherbar}
                  className="w-full text-center text-sm text-schaum/60 hover:text-bernstein disabled:opacity-40"
                >
                  Speichern & direkt Spiel starten →
                </button>
                {!routeName.trim() && (
                  <p className="text-center text-xs text-schaum/55">
                    Die Route braucht noch einen Namen.
                  </p>
                )}
              </>
            ) : schritt === 1 ? (
              <Button
                className="w-full"
                onClick={() => {
                  setErweitertOffen(true);
                  setSchritt(2);
                }}
              >
                Weiter zu den Regeln
              </Button>
            ) : schritt === 2 ? (
              <>
                <Button className="w-full" onClick={() => setSchritt(3)}>
                  Weiter zur Übersicht
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setSchritt(3)}>
                  Regeln überspringen
                </Button>
              </>
            ) : (
              <>
                <Button className="w-full" onClick={erstellen} disabled={busy}>
                  {busy ? "erstelle…" : "Spiel erstellen & Code generieren"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setSchritt(2)}>
                  Zurück zu den Regeln
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {routePickerOffen && routenListe && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-nacht/95 backdrop-blur">
          <div className="mx-auto flex h-full w-full max-w-md flex-col px-4">
            <div className="flex items-center justify-between py-3">
              <h2 className="font-display text-xl">Route laden</h2>
              <button
                onClick={() => setRoutePickerOffen(false)}
                className="grid h-10 w-10 place-items-center rounded-lg text-schaum/60 hover:bg-nacht-3 hover:text-schaum"
                aria-label="schließen"
              >
                <IconX size={22} />
              </button>
            </div>
            <p className="pb-3 text-xs text-schaum/55">
              Die Stops landen im Formular – Reihenfolge, Bars und Einstellungen kannst du danach
              noch ändern, ohne die gespeicherte Route zu verändern.
            </p>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
              <RoutenGruppe
                titel="Meine Routen"
                routen={routenListe.eigene}
                onWaehlen={routeInsFormular}
                hervorgehoben
              />
              <RoutenGruppe
                titel="Von der Community"
                routen={routenListe.community}
                onWaehlen={routeInsFormular}
              />
              {routenListe.eigene.length + routenListe.community.length === 0 && (
                <p className="mt-6 text-center text-sm text-schaum/60">
                  Noch keine gespeicherten Routen.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {pickerOffen && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-nacht/95 backdrop-blur">
          <div className="mx-auto flex h-full w-full max-w-md flex-col px-4">
            <div className="flex items-center justify-between py-3">
              <h2 className="font-display text-xl">Bar hinzufügen</h2>
              <button
                onClick={() => setPickerOffen(false)}
                className="grid h-10 w-10 place-items-center rounded-lg text-schaum/60 hover:bg-nacht-3 hover:text-schaum"
                aria-label="schließen"
              >
                <IconX size={22} />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-nacht-3 p-1">
              <button
                onClick={() => setPickerTab("liste")}
                disabled={verfuegbareGesamt === 0}
                className={`min-h-[44px] rounded-lg py-2 text-sm font-semibold transition disabled:opacity-40 ${
                  pickerTab === "liste" ? "bg-bernstein text-tinte" : "text-schaum/70"
                }`}
              >
                Aus Liste
              </button>
              <button
                onClick={() => setPickerTab("selbst")}
                className={`min-h-[44px] rounded-lg py-2 text-sm font-semibold transition ${
                  pickerTab === "selbst" ? "bg-bernstein text-tinte" : "text-schaum/70"
                }`}
              >
                Selbst hinzufügen
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              {pickerTab === "liste" ? (
                verfuegbareGesamt === 0 ? (
                  <p className="mt-6 text-center text-sm text-schaum/60">
                    Alle verfügbaren Bars sind schon in der Route. Wechsle zu „Selbst hinzufügen".
                  </p>
                ) : (
                  <div className="space-y-4">
                    <BarGruppe
                      titel="Meine Bars"
                      bars={verfuegbareEigene}
                      beliebt={beliebt}
                      onWaehlen={barHinzufuegen}
                      hervorgehoben
                    />
                    <BarGruppe
                      titel="Vorschläge"
                      bars={verfuegbareKuratiert}
                      beliebt={beliebt}
                      onWaehlen={barHinzufuegen}
                    />
                    <BarGruppe
                      titel="Von der Community"
                      bars={verfuegbareCommunity}
                      beliebt={beliebt}
                      onWaehlen={barHinzufuegen}
                    />
                    <p className="pt-2 text-xs text-schaum/55">
                      Bars aus- oder einblenden kannst du im Hauptmenü unter „Bars".
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <AdressSuche
                    naehe={stadt ? [stadt.lat, stadt.lng] : null}
                    placeholder="Adresse oder Bar suchen…"
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
                        placeholder="Name der Bar"
                      />
                      <p className="flex items-center gap-1.5 truncate text-xs text-schaum/60">
                        <IconPin size={13} className="shrink-0" />
                        <span className="truncate">{pending.adresse ?? "Position auf der Karte gewählt"}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-schaum/60">
                        <IconSchloss size={13} className="shrink-0" />
                        Wird privat in „Meine Bars" gespeichert – nur du und deine Mitspieler sehen sie.
                      </p>
                      {!stadt && (
                        <p className="flex items-center gap-1.5 text-xs text-schaum/60">
                          <IconPin size={13} className="shrink-0" />
                          {pendingStadt
                            ? `Stadt automatisch erkannt: ${pendingStadt.stadt.name}`
                            : "Keine bekannte Stadt in der Nähe – die Bar wird ohne Stadt gespeichert."}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={pendingBestaetigen}
                          disabled={!pending.name.trim() || pendingBusy}
                        >
                          {pendingBusy ? "speichere…" : "+ Als Stop hinzufügen"}
                        </Button>
                        <Button variant="ghost" onClick={pendingVerwerfen}>
                          Verwerfen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-schaum/55">
                      Tippe auf die Karte oder such eine Adresse. Den Pin kannst du zum Feinjustieren
                      verschieben.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="py-3">
              <Button variant="ghost" className="w-full" onClick={() => setPickerOffen(false)}>
                Fertig · {stopsText(stops.length)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Eine Gruppe im Bar-Picker (Meine / Vorschläge / Community). */
function BarGruppe({
  titel,
  bars,
  beliebt,
  onWaehlen,
  hervorgehoben = false,
}: {
  titel: string;
  bars: Bar[];
  beliebt: BeliebtheitMap;
  onWaehlen: (b: Bar) => void;
  hervorgehoben?: boolean;
}) {
  if (bars.length === 0) return null;
  return (
    <div className="space-y-2">
      <p
        className={`text-xs uppercase tracking-wide ${
          hervorgehoben ? "text-bernstein" : "text-schaum/55"
        }`}
      >
        {titel}
      </p>
      <ul className="space-y-2">
        {bars.map((b) => (
          <li
            key={b.id}
            className={`flex items-center gap-2 rounded-xl border bg-nacht-3 px-3 py-2 ${
              hervorgehoben ? "border-bernstein/30" : "border-[var(--linie)]"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate">{b.name}</span>
                {b.ersteller_user_id && b.sichtbarkeit === "oeffentlich" && (
                  <IconGlobus size={12} className="shrink-0 text-moos" />
                )}
                {b.ersteller_user_id && b.sichtbarkeit === "privat" && (
                  <IconSchloss size={12} className="shrink-0 text-schaum/55" />
                )}
                {b.herkunft === "uebernommen" && (
                  <IconUebernommen
                    size={12}
                    className="shrink-0 text-schaum/55"
                    // aus einer geteilten Route in die eigene Liste kopiert
                  />
                )}
                {stufe(beliebt.get(b.id)).rang >= 2 && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-bernstein">
                    <IconFlamme size={11} /> {stufe(beliebt.get(b.id)).label}
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-schaum/60">
                {beliebtheitText(beliebt.get(b.id)) ?? b.adresse}
              </span>
            </span>
            <button
              onClick={() => onWaehlen(b)}
              className="shrink-0 rounded-lg bg-bernstein px-3 py-2 text-sm font-semibold text-tinte"
            >
              + Hinzufügen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Eine Gruppe im Routen-Picker (Meine / Community). */
function RoutenGruppe({
  titel,
  routen,
  onWaehlen,
  hervorgehoben = false,
}: {
  titel: string;
  routen: RouteMitStops[];
  onWaehlen: (r: RouteMitStops) => void;
  hervorgehoben?: boolean;
}) {
  if (routen.length === 0) return null;
  return (
    <div className="space-y-2">
      <p
        className={`text-xs uppercase tracking-wide ${
          hervorgehoben ? "text-bernstein" : "text-schaum/55"
        }`}
      >
        {titel}
      </p>
      <ul className="space-y-2">
        {routen.map((r) => (
          <li
            key={r.id}
            className={`flex items-center gap-2 rounded-xl border bg-nacht-3 px-3 py-2 ${
              hervorgehoben ? "border-bernstein/30" : "border-[var(--linie)]"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate">{r.name}</span>
                {r.sichtbarkeit === "oeffentlich" ? (
                  <IconGlobus size={12} className="shrink-0 text-moos" />
                ) : (
                  <IconSchloss size={12} className="shrink-0 text-schaum/55" />
                )}
                {r.quelle_route_id && (
                  <IconUebernommen size={12} className="shrink-0 text-schaum/55" />
                )}
              </span>
              <span className="flex items-center gap-1 truncate text-xs text-schaum/60">
                <IconPin size={11} className="shrink-0" />
                {stopsText(r.stops.length)}
                {r.beschreibung ? ` · ${r.beschreibung}` : ""}
              </span>
            </span>
            <button
              onClick={() => onWaehlen(r)}
              className="shrink-0 rounded-lg bg-bernstein px-3 py-2 text-sm font-semibold text-tinte"
              disabled={r.stops.length === 0}
            >
              Laden
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Guard>
      <Suspense fallback={null}>
        <CreateInner />
      </Suspense>
    </Guard>
  );
}
