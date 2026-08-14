"use client";

/**
 * Routen-Ansicht: der dritte Verwaltungs-Menüpunkt neben Bars und Spielen.
 *
 *  • Meine Routen      – umbenennen, privat/öffentlich schalten, teilen,
 *                        löschen und mit einem Tipp spielen.
 *  • Von der Community – öffentliche Routen anderer: ansehen, übernehmen,
 *                        direkt spielen.
 *
 * Gebaut werden Routen dort, wo Stops sowieso entstehen: in der
 * Spielerstellung. Dieser Menüpunkt verwaltet sie nur – das hält den Weg
 * zum Spiel kurz und vermeidet einen zweiten Routen-Editor.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import {
  IconGlobus,
  IconKopieren,
  IconPapierkorb,
  IconPin,
  IconPlus,
  IconRoute,
  IconSchloss,
  IconStift,
  IconTeilen,
  IconUebernommen,
  IconWeiter,
} from "@/components/Icons";
import { istModerator } from "@/lib/ugc";
import {
  freierRoutenName,
  ladeRouten,
  routeLoeschen,
  routeSichtbarkeitSetzen,
  routeSperren,
  routeUebernehmen,
  teilenUrl,
  type RouteMitStops,
  type RoutenListe,
} from "@/lib/routen";
import type { BenutzerRolle } from "@/lib/types";

function Chip({
  ton = "neutral",
  children,
}: {
  ton?: "neutral" | "gut" | "warn";
  children: React.ReactNode;
}) {
  const stil = {
    neutral: "bg-nacht-2 text-schaum/60",
    gut: "bg-moos/20 text-moos",
    warn: "bg-ziegel/20 text-ziegel",
  }[ton];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${stil}`}
    >
      {children}
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

/** Kompakte Stop-Liste zum Aufklappen – reicht, um eine Route einzuschätzen. */
function StopListe({ route }: { route: RouteMitStops }) {
  return (
    <ol className="mt-2 space-y-1 border-t border-[var(--linie)] pt-2">
      {route.stops.map((s) => (
        <li key={s.id} className="flex gap-2 text-xs text-schaum/60">
          <span className="mono w-5 shrink-0 text-right text-bernstein">{s.position + 1}</span>
          <span className="min-w-0">
            <span className="block truncate text-schaum/80">{s.name}</span>
            {s.adresse && <span className="block truncate text-schaum/55">{s.adresse}</span>}
          </span>
        </li>
      ))}
      {route.stops.length === 0 && <li className="text-xs text-schaum/55">Keine Stops.</li>}
    </ol>
  );
}

export function RoutenAnsicht({
  userId,
  rolle,
}: {
  userId: string | undefined;
  rolle: BenutzerRolle;
}) {
  const router = useRouter();
  const [liste, setListe] = useState<RoutenListe | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = async () => setListe(await ladeRouten(userId));

  useEffect(() => {
    if (userId) laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!meldung) return;
    const t = setTimeout(() => setMeldung(null), 3500);
    return () => clearTimeout(t);
  }, [meldung]);

  if (!liste) {
    return (
      <div className="space-y-3">
        <div className="kg-skeleton h-12 w-full" />
        <div className="kg-skeleton h-32 w-full" />
      </div>
    );
  }

  const meineNamen = liste.eigene.map((r) => r.name);

  return (
    <div className="space-y-5">
      {meldung && (
        <p className="kg-pop rounded-xl border border-bernstein/40 bg-bernstein/10 px-3 py-2 text-sm">
          {meldung}
        </p>
      )}

      <Card className="space-y-3">
        <Button className="w-full" onClick={() => router.push("/create?modus=route")}>
          <IconPlus size={16} /> Neue Route bauen
        </Button>
        <p className="text-xs text-schaum/55">
          Stadt wählen, Bars zusammenstellen, Namen vergeben – ohne Spieleinstellungen. Gespielt
          wird später mit einem Tipp.
        </p>
      </Card>

      {/* Meine Routen */}
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Meine Routen</h2>
          <span className="text-xs text-schaum/55">{liste.eigene.length}</span>
        </div>
        {liste.eigene.length === 0 ? (
          <p className="text-xs text-schaum/55">
            Noch keine gespeicherte Route. Alles, was du beim Spiel-Erstellen zusammenstellst,
            kannst du dort dauerhaft sichern und später mit einem Tipp wieder spielen.
          </p>
        ) : (
          <ul className="space-y-2">
            {liste.eigene.map((r) => (
              <EigeneRouteZeile
                key={r.id}
                route={r}
                meineNamen={meineNamen}
                onAendern={laden}
                onMeldung={setMeldung}
              />
            ))}
          </ul>
        )}
      </Card>

      {/* Von der Community */}
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Von der Community</h2>
          <span className="text-xs text-schaum/55">{liste.community.length}</span>
        </div>
        <p className="text-xs text-schaum/55">
          Öffentliche Routen anderer Spieler:innen. Übernehmen legt eine eigene Kopie an – die
          bearbeitest du frei, ohne das Original zu verändern.
        </p>
        <ul className="space-y-2">
          {liste.community.map((r) => (
            <FremdeRouteZeile
              key={r.id}
              route={r}
              meineNamen={meineNamen}
              rolle={rolle}
              onAendern={laden}
              onMeldung={setMeldung}
            />
          ))}
          {liste.community.length === 0 && (
            <li className="text-sm text-schaum/60">Noch keine öffentlichen Routen.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

// ── eine eigene Route ─────────────────────────────────────────────

function EigeneRouteZeile({
  route,
  meineNamen,
  onAendern,
  onMeldung,
}: {
  route: RouteMitStops;
  meineNamen: string[];
  onAendern: () => void;
  onMeldung: (s: string) => void;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const oeffentlich = route.sichtbarkeit === "oeffentlich";

  const url = teilenUrl(route.teilen_token);

  async function teilen() {
    const text = `Kneipen-Golf-Route „${route.name}"`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Kneipen-Golf", text, url });
        return;
      } catch {
        /* Abbruch durch Nutzer – dann eben kopieren */
      }
    }
    kopieren();
  }

  function kopieren() {
    navigator.clipboard?.writeText(url).then(
      () => onMeldung("Link kopiert – einfach weiterschicken."),
      () => onMeldung(url)
    );
  }

  async function sichtbarkeitUmschalten() {
    if (
      !oeffentlich &&
      !window.confirm(
        `„${route.name}" für alle veröffentlichen?\n\n` +
          "Andere sehen dann Namen und Adressen aller Stops – auch die deiner privaten Bars."
      )
    )
      return;
    const ok = await routeSichtbarkeitSetzen(route.id, oeffentlich ? "privat" : "oeffentlich");
    onMeldung(
      ok
        ? oeffentlich
          ? `„${route.name}" ist wieder privat.`
          : `„${route.name}" ist jetzt öffentlich.`
        : "Das hat nicht geklappt."
    );
    if (ok) onAendern();
  }

  async function loeschen() {
    if (!window.confirm(`„${route.name}" löschen? Bereits gestartete Spiele bleiben bestehen.`))
      return;
    const ok = await routeLoeschen(route.id);
    onMeldung(ok ? `„${route.name}" gelöscht.` : "Löschen hat nicht geklappt.");
    if (ok) onAendern();
  }

  return (
    <li className="rounded-xl border border-[var(--linie)] bg-nacht-3 px-3 py-2">
      <div className="flex items-center gap-2">
        <button onClick={() => setOffen((o) => !o)} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-semibold">{route.name}</span>
            <Chip ton={oeffentlich ? "gut" : "neutral"}>
              {oeffentlich ? <IconGlobus size={11} /> : <IconSchloss size={11} />}
              {oeffentlich ? "öffentlich" : "privat"}
            </Chip>
            {route.quelle_route_id && (
              <Chip>
                <IconUebernommen size={11} /> übernommen
              </Chip>
            )}
            {route.gesperrt && <Chip ton="warn">gesperrt</Chip>}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-schaum/60">
            <IconPin size={12} className="shrink-0" />
            {route.stops.length} Stops
            {route.beschreibung ? ` · ${route.beschreibung}` : ""}
          </span>
        </button>

        <IconKnopf titel="Link teilen" onClick={teilen}>
          <IconTeilen size={17} />
        </IconKnopf>
        <IconKnopf
          titel={oeffentlich ? "wieder privat stellen" : "öffentlich stellen"}
          onClick={sichtbarkeitUmschalten}
        >
          {oeffentlich ? <IconSchloss size={17} /> : <IconGlobus size={17} />}
        </IconKnopf>
      </div>

      {offen && (
        <>
          <StopListe route={route} />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="flex-1"
              onClick={() => router.push(`/create?route=${route.id}`)}
              disabled={route.stops.length === 0}
            >
              Spielen <IconWeiter size={16} />
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => router.push(`/create?route=${route.id}&modus=route`)}
            >
              <IconStift size={16} /> Bearbeiten
            </Button>
            <IconKnopf titel="Link kopieren" onClick={kopieren}>
              <IconKopieren size={17} />
            </IconKnopf>
            <IconKnopf titel="löschen" gefahr onClick={loeschen}>
              <IconPapierkorb size={17} />
            </IconKnopf>
          </div>
          <p className="mt-2 text-xs text-schaum/55">
            Über „Bearbeiten" änderst du Name, Beschreibung und Stops.
          </p>
        </>
      )}
    </li>
  );
}

// ── eine fremde (öffentliche) Route ───────────────────────────────

function FremdeRouteZeile({
  route,
  meineNamen,
  rolle,
  onAendern,
  onMeldung,
}: {
  route: RouteMitStops;
  meineNamen: string[];
  rolle: BenutzerRolle;
  onAendern: () => void;
  onMeldung: (s: string) => void;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [formOffen, setFormOffen] = useState(false);
  const [name, setName] = useState(route.name);
  const [busy, setBusy] = useState(false);

  const konflikt =
    name.trim().length > 0 &&
    meineNamen.some((n) => n.trim().toLowerCase() === name.trim().toLowerCase());

  /**
   * Die Namensregel greift beim Übernehmen zuerst: gibt es den Namen
   * schon, steht direkt ein freier Vorschlag im Feld – ein Tipp, fertig.
   */
  function uebernahmeStarten() {
    setName(freierRoutenName(route.name, meineNamen));
    setFormOffen(true);
    setOffen(true);
  }

  async function uebernehmen() {
    if (konflikt || !name.trim()) return;
    setBusy(true);
    const res = await routeUebernehmen(route.teilen_token, name);
    setBusy(false);
    if (!res.ok) {
      onMeldung(res.meldung);
      return;
    }
    setFormOffen(false);
    onMeldung(`„${res.name}" liegt jetzt unter „Meine Routen".`);
    onAendern();
  }

  return (
    <li className="rounded-xl border border-[var(--linie)] bg-nacht-3 px-3 py-2">
      <div className="flex items-center gap-2">
        <button onClick={() => setOffen((o) => !o)} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-1.5">
            <IconRoute size={14} className="shrink-0 text-bernstein" />
            <span className="truncate font-semibold">{route.name}</span>
            {route.gesperrt && <Chip ton="warn">gesperrt</Chip>}
          </span>
          <span className="mt-0.5 block text-xs text-schaum/60">
            {route.stops.length} Stops
            {route.beschreibung ? ` · ${route.beschreibung}` : ""}
          </span>
        </button>

        <Button variant="ghost" onClick={uebernahmeStarten} className="shrink-0 px-3 py-2 text-sm">
          <IconUebernommen size={15} /> Übernehmen
        </Button>
      </div>

      {offen && (
        <>
          <StopListe route={route} />

          {formOffen ? (
            <div className="mt-3 space-y-2">
              <Field label="Name in deiner Liste">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              {konflikt ? (
                <button
                  onClick={() => setName(freierRoutenName(name, meineNamen))}
                  className="text-left text-xs text-ziegel underline"
                >
                  Du hast schon eine Route mit diesem Namen – „
                  {freierRoutenName(name, meineNamen)}" nehmen?
                </button>
              ) : (
                <p className="text-xs text-schaum/55">
                  Öffentliche Bars bleiben verlinkt, private Bars werden als eigene Kopie
                  gespeichert und in „Bars" als übernommen markiert.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={uebernehmen}
                  disabled={busy || konflikt || !name.trim()}
                >
                  {busy ? "…" : "Zu meinen Routen"}
                </Button>
                <Button variant="ghost" onClick={() => setFormOffen(false)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="flex-1"
                onClick={() => router.push(`/create?route=${route.id}`)}
                disabled={route.stops.length === 0}
              >
                Direkt spielen <IconWeiter size={16} />
              </Button>
              {istModerator(rolle) && (
                <IconKnopf
                  titel={route.gesperrt ? "entsperren" : "global sperren"}
                  gefahr={!route.gesperrt}
                  onClick={async () => {
                    await routeSperren(route.id, !route.gesperrt);
                    onAendern();
                  }}
                >
                  <IconSchloss size={17} />
                </IconKnopf>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}
