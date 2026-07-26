"use client";

/**
 * Bibliothek: die beiden Verwaltungs-Ansichten des Hauptmenüs.
 *
 *  • BarsAnsicht    – eigene Bars anlegen, umbenennen, löschen,
 *                     privat/öffentlich schalten; fremde Bars ausblenden.
 *  • SpieleAnsicht   – dasselbe für Spielformen (Minigames).
 *
 * Rechte kommen aus `darfBearbeiten` und spiegeln 1:1 die RLS-Policies –
 * die UI zeigt also nur Aktionen, die die Datenbank auch zulässt.
 */

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { AdressSuche, type GeoTreffer } from "@/components/AdressSuche";
import {
  IconAuge,
  IconAugeAus,
  IconGlobus,
  IconPapierkorb,
  IconPin,
  IconFlamme,
  IconPlus,
  IconSchloss,
  IconUebernommen,
  IconWarnung,
  IconX,
} from "@/components/Icons";
import {
  barAnlegen,
  barAusblenden,
  barLoeschen,
  barMelden,
  barSichtbarkeitSetzen,
  barSperren,
  darfBearbeiten,
  istModerator,
  ladeBars,
  ladeSpielformen,
  spielformAnlegen,
  spielformAusblenden,
  spielformLoeschen,
  spielformSichtbarkeitSetzen,
  type BarListe,
  type SpielformListe,
} from "@/lib/ugc";
import { erkenneStadt, normalisiere, type Ortstreffer } from "@/lib/orte";
import {
  beliebtheitText,
  ladeBeliebtheit,
  leereBeliebtheit,
  nachBeliebtheit,
  stufe,
  type Beliebtheit,
  type BeliebtheitMap,
} from "@/lib/beliebtheit";
import type { Bar, BenutzerRolle, Spielform, Stadt } from "@/lib/types";

// ── kleine Bausteine ──────────────────────────────────────────────

function SichtbarkeitsChip({ oeffentlich }: { oeffentlich: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
        oeffentlich ? "bg-moos/20 text-moos" : "bg-nacht-2 text-schaum/50"
      }`}
    >
      {oeffentlich ? <IconGlobus size={11} /> : <IconSchloss size={11} />}
      {oeffentlich ? "öffentlich" : "privat"}
    </span>
  );
}

/**
 * Marke für Bars, die aus einer geteilten Route stammen. Sie gehören
 * dem Konto wie jede andere private Bar – das Symbol erklärt nur, woher
 * sie kam, damit die eigene Liste nachvollziehbar bleibt.
 */
function UebernommenChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-nacht-2 px-2 py-0.5 text-[11px] text-schaum/50">
      <IconUebernommen size={11} /> übernommen
    </span>
  );
}

function IconKnopf({
  onClick,
  titel,
  children,
  gefahr = false,
}: {
  onClick: () => void;
  titel: string;
  children: React.ReactNode;
  gefahr?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={titel}
      aria-label={titel}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition hover:bg-nacht-2 ${
        gefahr ? "text-ziegel" : "text-schaum/60 hover:text-schaum"
      }`}
    >
      {children}
    </button>
  );
}

function Abschnitt({
  titel,
  anzahl,
  hinweis,
  children,
}: {
  titel: string;
  anzahl?: number;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs uppercase tracking-wide text-bernstein">{titel}</h3>
        {anzahl !== undefined && <span className="text-xs text-schaum/40">{anzahl}</span>}
      </div>
      {hinweis && <p className="text-xs text-schaum/40">{hinweis}</p>}
      {children}
    </div>
  );
}

// ── Bars ──────────────────────────────────────────────────────────

/**
 * Filter der Bar-Bibliothek.
 *
 * `alle` · Stadt-ID · `meine` (nur selbst angelegte) · `ohne` (keine Stadt).
 *
 * Die Leiste zeigt bewusst nur eine Handvoll Chips: Sobald Städte
 * dazukommen, würde eine Chipzeile pro Stadt unbrauchbar lang. Alles
 * Weitere liegt hinter dem Plus.
 */
type StadtFilter = number | "alle" | "ohne" | "meine";

/** So viele Städte stehen direkt in der Leiste, der Rest wandert hinters Plus. */
const SICHTBARE_STAEDTE = 4;

/**
 * Beliebtheits-Marke. Bewusst eine Stufe statt einer Punktzahl: „37" sagt
 * niemandem etwas, „beliebt" schon. Neue Bars bekommen gar nichts – ein
 * Abzeichen „0 Punkte" wäre eine Bestrafung fürs Neusein.
 */
function BeliebtheitsChip({ wert }: { wert: Beliebtheit | undefined }) {
  const s = stufe(wert);
  if (s.rang === 0) return null;
  const stil = ["", "bg-nacht-2 text-schaum/60", "bg-bernstein/15 text-bernstein", "bg-bernstein/25 text-bernstein"][
    s.rang
  ];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${stil}`}
      title={beliebtheitText(wert) ?? undefined}
    >
      <IconFlamme size={11} /> {s.label}
    </span>
  );
}

function FilterChip({
  label,
  anzahl,
  aktiv,
  onClick,
}: {
  label: string;
  anzahl: number;
  aktiv: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        aktiv
          ? "border-bernstein bg-bernstein/15"
          : "border-[var(--linie)] bg-nacht-2 text-schaum/60 hover:text-schaum"
      }`}
    >
      {label}
      <span className={`text-xs ${aktiv ? "text-bernstein" : "text-schaum/40"}`}>{anzahl}</span>
    </button>
  );
}

export function BarsAnsicht({
  userId,
  rolle,
  staedte,
}: {
  userId: string | undefined;
  rolle: BenutzerRolle;
  staedte: Stadt[];
}) {
  const [liste, setListe] = useState<BarListe | null>(null);
  const [formOffen, setFormOffen] = useState(false);
  const [treffer, setTreffer] = useState<GeoTreffer | null>(null);
  const [name, setName] = useState("");
  const [stadtId, setStadtId] = useState<number | null>(null);
  /** Wurde die Stadt automatisch gesetzt? Nur für den Hinweistext. */
  const [stadtAuto, setStadtAuto] = useState<Ortstreffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [nurEigene, setNurEigene] = useState(false);
  /** Stadt-Filter über beide Listen */
  const [filter, setFilter] = useState<StadtFilter>("alle");
  const [stadtwahlOffen, setStadtwahlOffen] = useState(false);
  const [stadtSuche, setStadtSuche] = useState("");
  /** Volle Städteliste im Anlege-Formular (sonst reicht der erkannte Chip) */
  const [stadtListeOffen, setStadtListeOffen] = useState(false);
  const [werte, setWerte] = useState<BeliebtheitMap>(leereBeliebtheit);
  const [sortierung, setSortierung] = useState<"beliebt" | "name">("beliebt");

  const gewaehlteStadtImFormular = staedte.find((s) => s.id === stadtId) ?? null;

  const laden = async () => {
    const l = await ladeBars(userId);
    setListe(l);
    // Kennzahlen in einem zweiten Zug – die Liste soll nicht darauf warten.
    const ids = [...l.eigene, ...l.kuratiert, ...l.community].map((b) => b.id);
    setWerte(await ladeBeliebtheit(ids));
  };

  useEffect(() => {
    if (userId) laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!meldung) return;
    const t = setTimeout(() => setMeldung(null), 3500);
    return () => clearTimeout(t);
  }, [meldung]);

  async function anlegen() {
    if (!userId || !treffer || !name.trim()) return;
    setBusy(true);
    const bar = await barAnlegen(userId, {
      name,
      lat: treffer.lat,
      lng: treffer.lng,
      adresse: treffer.label,
      stadt_id: stadtId,
    });
    setBusy(false);
    if (!bar) {
      setMeldung("Speichern hat nicht geklappt – nochmal versuchen?");
      return;
    }
    setName("");
    setTreffer(null);
    setStadtId(null);
    setStadtAuto(null);
    setStadtListeOffen(false);
    setFormOffen(false);
    // Filter mitziehen, sonst landet die neue Bar hinter einem aktiven
    // Stadt-Filter und wirkt, als wäre sie nicht gespeichert worden.
    setFilter(bar.stadt_id ?? "ohne");
    setMeldung(`„${bar.name}" ist gespeichert – privat, nur für dich.`);
    laden();
  }

  /**
   * Adresse gewählt: Name vorschlagen UND die Stadt automatisch zuordnen.
   * Die Erkennung ist ein Vorschlag – ein Tipp auf einen anderen Chip
   * (oder auf denselben) überschreibt sie jederzeit.
   */
  function trefferWaehlen(t: GeoTreffer) {
    setTreffer(t);
    setName((n) => n || t.name);
    const erkannt = erkenneStadt(staedte, { ort: t.ort, lat: t.lat, lng: t.lng });
    setStadtAuto(erkannt);
    setStadtId(erkannt?.stadt.id ?? null);
  }

  if (!liste) {
    return (
      <div className="space-y-3">
        <div className="kg-skeleton h-12 w-full" />
        <div className="kg-skeleton h-32 w-full" />
      </div>
    );
  }

  const fremde = [...liste.kuratiert, ...liste.community];
  const alleBars = [...liste.eigene, ...fremde];

  /** Der Filter gilt für beide Listen – „Meine Bars" und die Bibliothek. */
  const trifftZu = (b: Bar, f: StadtFilter) =>
    f === "alle"
      ? true
      : f === "meine"
        ? b.ersteller_user_id === userId
        : f === "ohne"
          ? !b.stadt_id
          : b.stadt_id === f;

  const anzahlFuer = (f: StadtFilter) => alleBars.filter((b) => trifftZu(b, f)).length;

  const sortiere = (l: Bar[]) =>
    sortierung === "beliebt"
      ? nachBeliebtheit(l, werte)
      : [...l].sort((a, b) => a.name.localeCompare(b.name, "de"));

  const eigeneGefiltert = sortiere(liste.eigene.filter((b) => trifftZu(b, filter)));
  const fremdeGefiltert = sortiere(
    fremde
      .filter((b) => trifftZu(b, filter))
      .filter((b) => (nurEigene ? liste.ausgeblendet.has(b.id) : true))
  );

  /**
   * Welche Städte stehen direkt in der Leiste?
   *
   * Reihenfolge: erst Städte, in denen ich eigene Bars habe – das ist die
   * Liste, die man im Alltag braucht –, dann die mit den meisten Bars.
   * Die gerade gewählte Stadt ist immer dabei, sonst würde der aktive
   * Filter hinter dem Plus verschwinden.
   */
  const eigeneProStadt = new Map<number, number>();
  for (const b of liste.eigene) {
    if (b.stadt_id) eigeneProStadt.set(b.stadt_id, (eigeneProStadt.get(b.stadt_id) ?? 0) + 1);
  }
  const sortiert = [...staedte].sort((a, c) => {
    const ea = eigeneProStadt.get(a.id) ?? 0;
    const ec = eigeneProStadt.get(c.id) ?? 0;
    if (ea !== ec) return ec - ea;
    const ga = anzahlFuer(a.id);
    const gc = anzahlFuer(c.id);
    if (ga !== gc) return gc - ga;
    return a.name.localeCompare(c.name, "de");
  });

  const vorne = sortiert.slice(0, SICHTBARE_STAEDTE);
  const gewaehlteStadt =
    typeof filter === "number" ? (staedte.find((s) => s.id === filter) ?? null) : null;
  const sichtbareStaedte =
    gewaehlteStadt && !vorne.some((s) => s.id === gewaehlteStadt.id)
      ? [...vorne.slice(0, SICHTBARE_STAEDTE - 1), gewaehlteStadt]
      : vorne;

  const weitereStaedte = sortiert.filter((s) => !sichtbareStaedte.some((v) => v.id === s.id));
  const ohneAnzahl = anzahlFuer("ohne");
  const plusNoetig = weitereStaedte.length > 0 || ohneAnzahl > 0;

  const suchTreffer = weitereStaedte.filter((s) =>
    stadtSuche.trim() ? normalisiere(s.name).includes(normalisiere(stadtSuche)) : true
  );

  function filterWaehlen(f: StadtFilter) {
    setFilter(f);
    setStadtwahlOffen(false);
    setStadtSuche("");
  }

  return (
    <div className="space-y-5">
      {meldung && (
        <p className="kg-pop rounded-xl border border-bernstein/40 bg-bernstein/10 px-3 py-2 text-sm">
          {meldung}
        </p>
      )}

      {/* Bar hinzufügen */}
      <Card className="space-y-3">
        {!formOffen ? (
          <Button className="w-full" onClick={() => setFormOffen(true)}>
            <IconPlus size={16} /> Bar hinzufügen
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Neue Bar</h2>
              <IconKnopf titel="abbrechen" onClick={() => setFormOffen(false)}>
                <IconX />
              </IconKnopf>
            </div>
            <AdressSuche placeholder="Adresse oder Bar suchen…" onWaehlen={trefferWaehlen} />
            {treffer && (
              <>
                <Field label="Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name der Bar" />
                </Field>
                <p className="flex items-center gap-1.5 text-xs text-schaum/50">
                  <IconPin size={13} className="shrink-0" />
                  <span className="truncate">{treffer.label}</span>
                </p>
                {/*
                  Die Stadt ist meist schon erkannt – dann reicht ein Chip
                  plus „ändern". Erst dort wird die volle Liste ausgerollt,
                  damit das Formular auch bei vielen Städten kurz bleibt.
                */}
                <Field label="Stadt">
                  {gewaehlteStadtImFormular && !stadtListeOffen ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-bernstein bg-bernstein/15 px-3 py-1.5 text-sm">
                        {gewaehlteStadtImFormular.name}
                      </span>
                      <button
                        onClick={() => setStadtListeOffen(true)}
                        className="text-xs text-schaum/50 hover:text-bernstein"
                      >
                        ändern
                      </button>
                    </div>
                  ) : (
                    <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                      {staedte.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setStadtId(stadtId === s.id ? null : s.id);
                            setStadtAuto(null); // ab jetzt hat die Person entschieden
                            setStadtListeOffen(false);
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            stadtId === s.id
                              ? "border-bernstein bg-bernstein/15"
                              : "border-[var(--linie)] bg-nacht-2 text-schaum/60"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
                <p className="text-xs text-schaum/40">
                  {stadtAuto
                    ? `Automatisch erkannt: ${stadtAuto.stadt.name}${
                        stadtAuto.quelle === "naehe" ? " (nächstgelegene Stadt)" : ""
                      }`
                    : stadtId
                      ? "Stadt selbst gewählt."
                      : "Keine Stadt erkannt – optional selbst zuordnen."}
                </p>
                <Button className="w-full" disabled={!name.trim() || busy} onClick={anlegen}>
                  {busy ? "speichere…" : "Privat speichern"}
                </Button>
                <p className="text-xs text-schaum/40">
                  Neue Bars sind immer erst privat. Veröffentlichen kannst du sie danach hier in
                  der Liste.
                </p>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Filter – gilt für beide Listen darunter */}
      {staedte.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="Alle"
              anzahl={alleBars.length}
              aktiv={filter === "alle"}
              onClick={() => filterWaehlen("alle")}
            />
            {sichtbareStaedte.map((s) => (
              <FilterChip
                key={s.id}
                label={s.name}
                anzahl={anzahlFuer(s.id)}
                aktiv={filter === s.id}
                onClick={() => filterWaehlen(s.id)}
              />
            ))}
            <FilterChip
              label="Meine"
              anzahl={liste.eigene.length}
              aktiv={filter === "meine"}
              onClick={() => filterWaehlen("meine")}
            />
            {plusNoetig && (
              <button
                onClick={() => setStadtwahlOffen((o) => !o)}
                aria-label="weitere Städte"
                title="weitere Städte"
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
                  stadtwahlOffen
                    ? "border-bernstein bg-bernstein/15 text-bernstein"
                    : "border-[var(--linie)] bg-nacht-2 text-schaum/60 hover:text-schaum"
                }`}
              >
                {stadtwahlOffen ? <IconX size={16} /> : <IconPlus size={16} />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-schaum/40">
            <span>Sortierung</span>
            {(["beliebt", "name"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortierung(s)}
                className={sortierung === s ? "text-bernstein" : "hover:text-schaum"}
              >
                {s === "beliebt" ? "beliebteste zuerst" : "A–Z"}
              </button>
            ))}
          </div>

          {/* Alle übrigen Städte – erst auf Wunsch, mit Suche */}
          {stadtwahlOffen && (
            <div className="space-y-2 rounded-xl border border-[var(--linie)] bg-nacht-2 p-3">
              {weitereStaedte.length > 6 && (
                <Input
                  value={stadtSuche}
                  onChange={(e) => setStadtSuche(e.target.value)}
                  placeholder="Stadt suchen…"
                  autoFocus
                />
              )}
              <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto">
                {suchTreffer.map((s) => (
                  <FilterChip
                    key={s.id}
                    label={s.name}
                    anzahl={anzahlFuer(s.id)}
                    aktiv={filter === s.id}
                    onClick={() => filterWaehlen(s.id)}
                  />
                ))}
                {ohneAnzahl > 0 && !stadtSuche.trim() && (
                  <FilterChip
                    label="Ohne Stadt"
                    anzahl={ohneAnzahl}
                    aktiv={filter === "ohne"}
                    onClick={() => filterWaehlen("ohne")}
                  />
                )}
                {suchTreffer.length === 0 && ohneAnzahl === 0 && (
                  <p className="text-sm text-schaum/50">Keine weitere Stadt gefunden.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meine Bars */}
      <Card className="space-y-3">
        <Abschnitt
          titel="Meine Bars"
          anzahl={eigeneGefiltert.length}
          hinweis={
            liste.eigene.length === 0
              ? "Noch keine eigene Bar. Alles, was du hier oder in einer Route anlegst, landet dauerhaft in dieser Liste."
              : eigeneGefiltert.length === 0
                ? "Keine eigene Bar in dieser Auswahl."
                : undefined
          }
        >
          <ul className="space-y-1.5">
            {eigeneGefiltert.map((b) => (
              <BarZeile
                key={b.id}
                bar={b}
                eigen
                userId={userId}
                rolle={rolle}
                ausgeblendet={liste.ausgeblendet.has(b.id)}
                beliebtheit={werte.get(b.id)}
                onAendern={laden}
                onMeldung={setMeldung}
              />
            ))}
          </ul>
        </Abschnitt>
      </Card>

      {/* Alle verfügbaren Bars – bei „Meine" wäre die Liste per Definition leer */}
      {filter !== "meine" && (
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Bar-Bibliothek</h2>
          <button
            onClick={() => setNurEigene((v) => !v)}
            className="text-xs text-schaum/50 hover:text-bernstein"
          >
            {nurEigene ? "alle zeigen" : "ausgeblendete zeigen"}
          </button>
        </div>
        <p className="text-xs text-schaum/40">
          Ausblenden ist nur für dich – die Bar bleibt für alle anderen erhalten.
        </p>
        <ul className="space-y-1.5">
          {fremdeGefiltert.map((b) => (
            <BarZeile
              key={b.id}
              bar={b}
              userId={userId}
              rolle={rolle}
              ausgeblendet={liste.ausgeblendet.has(b.id)}
              beliebtheit={werte.get(b.id)}
              onAendern={laden}
              onMeldung={setMeldung}
            />
          ))}
          {fremdeGefiltert.length === 0 && (
            <li className="text-sm text-schaum/50">
              {fremde.length === 0
                ? "Noch keine Bars in der Bibliothek."
                : nurEigene
                  ? "Hier ist nichts ausgeblendet."
                  : "Keine Bars in dieser Auswahl."}
            </li>
          )}
        </ul>
      </Card>
      )}
    </div>
  );
}

function BarZeile({
  bar,
  eigen = false,
  userId,
  rolle,
  ausgeblendet,
  beliebtheit,
  onAendern,
  onMeldung,
}: {
  bar: Bar;
  eigen?: boolean;
  userId: string | undefined;
  rolle: BenutzerRolle;
  ausgeblendet: boolean;
  beliebtheit?: Beliebtheit;
  onAendern: () => void;
  onMeldung: (s: string) => void;
}) {
  const darf = darfBearbeiten(bar, userId, rolle);
  const oeffentlich = bar.sichtbarkeit === "oeffentlich";

  async function sichtbarkeitUmschalten() {
    if (
      !oeffentlich &&
      !window.confirm(
        `„${bar.name}" für alle Spieler veröffentlichen? Danach kann jede:r die Bar in eigene Routen aufnehmen.`
      )
    )
      return;
    const ok = await barSichtbarkeitSetzen(bar.id, oeffentlich ? "privat" : "oeffentlich");
    onMeldung(
      ok
        ? oeffentlich
          ? `„${bar.name}" ist wieder privat.`
          : `„${bar.name}" ist jetzt öffentlich.`
        : "Das hat nicht geklappt."
    );
    if (ok) onAendern();
  }

  async function loeschen() {
    if (
      !window.confirm(
        `„${bar.name}" endgültig löschen? Bereits gespielte Touren behalten den Stop.`
      )
    )
      return;
    const ok = await barLoeschen(bar.id);
    onMeldung(ok ? `„${bar.name}" gelöscht.` : "Löschen hat nicht geklappt.");
    if (ok) onAendern();
  }

  async function ausblendenUmschalten() {
    if (!userId) return;
    await barAusblenden(userId, bar.id, !ausgeblendet);
    onAendern();
  }

  async function melden() {
    if (!userId) return;
    const grund = window.prompt("Was stimmt mit dieser Bar nicht? (kurz)");
    if (!grund) return;
    await barMelden(userId, bar.id, grund);
    onMeldung("Danke – die Meldung ist raus.");
  }

  return (
    <li
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
        ausgeblendet
          ? "border-[var(--linie)] bg-nacht-3/40 opacity-60"
          : "border-[var(--linie)] bg-nacht-3"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate">{bar.name}</span>
          <BeliebtheitsChip wert={beliebtheit} />
          {eigen && <SichtbarkeitsChip oeffentlich={oeffentlich} />}
          {eigen && bar.herkunft === "uebernommen" && <UebernommenChip />}
          {bar.gesperrt && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ziegel/20 px-2 py-0.5 text-[11px] text-ziegel">
              <IconWarnung size={11} /> gesperrt
            </span>
          )}
        </span>
        {beliebtheitText(beliebtheit) ? (
          <span className="block truncate text-xs text-schaum/50">
            {beliebtheitText(beliebtheit)}
          </span>
        ) : (
          bar.adresse && <span className="block truncate text-xs text-schaum/50">{bar.adresse}</span>
        )}
      </span>

      <IconKnopf
        titel={ausgeblendet ? "wieder einblenden" : "für mich ausblenden"}
        onClick={ausblendenUmschalten}
      >
        {ausgeblendet ? <IconAugeAus size={17} /> : <IconAuge size={17} />}
      </IconKnopf>

      {darf && (
        <>
          <IconKnopf
            titel={oeffentlich ? "wieder privat stellen" : "öffentlich stellen"}
            onClick={sichtbarkeitUmschalten}
          >
            {oeffentlich ? <IconSchloss size={17} /> : <IconGlobus size={17} />}
          </IconKnopf>
          <IconKnopf titel="löschen" gefahr onClick={loeschen}>
            <IconPapierkorb size={17} />
          </IconKnopf>
        </>
      )}

      {!darf && !eigen && (
        <IconKnopf titel="Bar melden" onClick={melden}>
          <IconWarnung size={17} />
        </IconKnopf>
      )}

      {istModerator(rolle) && !eigen && (
        <IconKnopf
          titel={bar.gesperrt ? "entsperren" : "global sperren"}
          gefahr={!bar.gesperrt}
          onClick={async () => {
            await barSperren(bar.id, !bar.gesperrt);
            onAendern();
          }}
        >
          <IconSchloss size={17} />
        </IconKnopf>
      )}
    </li>
  );
}

// ── Spielformen ───────────────────────────────────────────────────

export function SpieleAnsicht({
  userId,
  rolle,
}: {
  userId: string | undefined;
  rolle: BenutzerRolle;
}) {
  const [liste, setListe] = useState<SpielformListe | null>(null);
  const [formOffen, setFormOffen] = useState(false);
  const [titel, setTitel] = useState("");
  const [besch, setBesch] = useState("");
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = async () => setListe(await ladeSpielformen(userId));

  useEffect(() => {
    if (userId) laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!meldung) return;
    const t = setTimeout(() => setMeldung(null), 3500);
    return () => clearTimeout(t);
  }, [meldung]);

  const aktiveAnzahl = useMemo(() => {
    if (!liste) return 0;
    const alle = [...liste.global, ...liste.community, ...liste.eigene];
    return alle.filter((s) => !liste.ausgeblendet.has(s.id)).length;
  }, [liste]);

  async function anlegen() {
    if (!userId || !titel.trim()) return;
    setBusy(true);
    const sf = await spielformAnlegen(userId, titel, besch);
    setBusy(false);
    if (!sf) {
      setMeldung("Speichern hat nicht geklappt – nochmal versuchen?");
      return;
    }
    setTitel("");
    setBesch("");
    setFormOffen(false);
    setMeldung(`„${sf.titel}" ist gespeichert – privat, nur für dich.`);
    laden();
  }

  if (!liste) {
    return (
      <div className="space-y-3">
        <div className="kg-skeleton h-12 w-full" />
        <div className="kg-skeleton h-32 w-full" />
      </div>
    );
  }

  const fremde = [...liste.global, ...liste.community];

  return (
    <div className="space-y-5">
      {meldung && (
        <p className="kg-pop rounded-xl border border-bernstein/40 bg-bernstein/10 px-3 py-2 text-sm">
          {meldung}
        </p>
      )}

      <Card className="space-y-3">
        {!formOffen ? (
          <Button className="w-full" onClick={() => setFormOffen(true)}>
            <IconPlus size={16} /> Eigenes Spiel hinzufügen
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Neues Spiel</h2>
              <IconKnopf titel="abbrechen" onClick={() => setFormOffen(false)}>
                <IconX />
              </IconKnopf>
            </div>
            <Field label="Titel">
              <Input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Einbeinig" />
            </Field>
            <Field label="Regel">
              <Input
                value={besch}
                onChange={(e) => setBesch(e.target.value)}
                placeholder="Kurz und eindeutig – am Tisch muss es sofort klar sein."
              />
            </Field>
            <Button className="w-full" disabled={!titel.trim() || busy} onClick={anlegen}>
              {busy ? "speichere…" : "Privat speichern"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <Abschnitt
          titel="Meine Spiele"
          anzahl={liste.eigene.length}
          hinweis={
            liste.eigene.length === 0
              ? "Eigene Spielformen bleiben am Konto – du musst sie nicht pro Tour neu tippen."
              : undefined
          }
        >
          <ul className="space-y-1.5">
            {liste.eigene.map((s) => (
              <SpielformZeile
                key={s.id}
                sf={s}
                eigen
                userId={userId}
                rolle={rolle}
                ausgeblendet={liste.ausgeblendet.has(s.id)}
                onAendern={laden}
                onMeldung={setMeldung}
              />
            ))}
          </ul>
        </Abschnitt>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Spiel-Bibliothek</h2>
          <span className="text-xs text-schaum/40">{aktiveAnzahl} im Spiel</span>
        </div>
        <p className="text-xs text-schaum/40">
          Ausgeblendete Spiele werden in neuen Touren nicht mehr gezogen.
        </p>
        <ul className="space-y-1.5">
          {fremde.map((s) => (
            <SpielformZeile
              key={s.id}
              sf={s}
              userId={userId}
              rolle={rolle}
              ausgeblendet={liste.ausgeblendet.has(s.id)}
              onAendern={laden}
              onMeldung={setMeldung}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SpielformZeile({
  sf,
  eigen = false,
  userId,
  rolle,
  ausgeblendet,
  onAendern,
  onMeldung,
}: {
  sf: Spielform;
  eigen?: boolean;
  userId: string | undefined;
  rolle: BenutzerRolle;
  ausgeblendet: boolean;
  onAendern: () => void;
  onMeldung: (s: string) => void;
}) {
  const darf = darfBearbeiten(sf, userId, rolle);
  const oeffentlich = sf.sichtbarkeit === "oeffentlich";

  return (
    <li
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
        ausgeblendet
          ? "border-[var(--linie)] bg-nacht-3/40 opacity-60"
          : "border-[var(--linie)] bg-nacht-3"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{sf.titel}</span>
          {eigen && <SichtbarkeitsChip oeffentlich={oeffentlich} />}
        </span>
        {sf.beschreibung && (
          <span className="block text-xs text-schaum/50">{sf.beschreibung}</span>
        )}
      </span>

      <IconKnopf
        titel={ausgeblendet ? "wieder einblenden" : "für mich ausblenden"}
        onClick={async () => {
          if (!userId) return;
          await spielformAusblenden(userId, sf.id, !ausgeblendet);
          onAendern();
        }}
      >
        {ausgeblendet ? <IconAugeAus size={17} /> : <IconAuge size={17} />}
      </IconKnopf>

      {darf && (
        <>
          <IconKnopf
            titel={oeffentlich ? "wieder privat stellen" : "öffentlich stellen"}
            onClick={async () => {
              const ok = await spielformSichtbarkeitSetzen(
                sf.id,
                oeffentlich ? "privat" : "oeffentlich"
              );
              onMeldung(ok ? "Sichtbarkeit geändert." : "Das hat nicht geklappt.");
              if (ok) onAendern();
            }}
          >
            {oeffentlich ? <IconSchloss size={17} /> : <IconGlobus size={17} />}
          </IconKnopf>
          <IconKnopf
            titel="löschen"
            gefahr
            onClick={async () => {
              if (!window.confirm(`„${sf.titel}" endgültig löschen?`)) return;
              const ok = await spielformLoeschen(sf.id);
              onMeldung(ok ? "Gelöscht." : "Löschen hat nicht geklappt.");
              if (ok) onAendern();
            }}
          >
            <IconPapierkorb size={17} />
          </IconKnopf>
        </>
      )}
    </li>
  );
}
