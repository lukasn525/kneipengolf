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
  IconPlus,
  IconSchloss,
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
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [nurEigene, setNurEigene] = useState(false);

  const laden = async () => setListe(await ladeBars(userId));

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
    setFormOffen(false);
    setMeldung(`„${bar.name}" ist gespeichert – privat, nur für dich.`);
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

  const fremde = [...liste.kuratiert, ...liste.community];

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
            <AdressSuche
              placeholder="Adresse oder Bar suchen…"
              onWaehlen={(t) => {
                setTreffer(t);
                setName((n) => n || t.name);
              }}
            />
            {treffer && (
              <>
                <Field label="Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name der Bar" />
                </Field>
                <p className="flex items-center gap-1.5 text-xs text-schaum/50">
                  <IconPin size={13} className="shrink-0" />
                  <span className="truncate">{treffer.label}</span>
                </p>
                <Field label="Stadt zuordnen (optional)">
                  <div className="flex flex-wrap gap-2">
                    {staedte.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setStadtId(stadtId === s.id ? null : s.id)}
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
                </Field>
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

      {/* Meine Bars */}
      <Card className="space-y-3">
        <Abschnitt
          titel="Meine Bars"
          anzahl={liste.eigene.length}
          hinweis={
            liste.eigene.length === 0
              ? "Noch keine eigene Bar. Alles, was du hier oder in einer Route anlegst, landet dauerhaft in dieser Liste."
              : undefined
          }
        >
          <ul className="space-y-1.5">
            {liste.eigene.map((b) => (
              <BarZeile
                key={b.id}
                bar={b}
                eigen
                userId={userId}
                rolle={rolle}
                ausgeblendet={liste.ausgeblendet.has(b.id)}
                onAendern={laden}
                onMeldung={setMeldung}
              />
            ))}
          </ul>
        </Abschnitt>
      </Card>

      {/* Alle verfügbaren Bars */}
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
          {fremde
            .filter((b) => (nurEigene ? liste.ausgeblendet.has(b.id) : true))
            .map((b) => (
              <BarZeile
                key={b.id}
                bar={b}
                userId={userId}
                rolle={rolle}
                ausgeblendet={liste.ausgeblendet.has(b.id)}
                onAendern={laden}
                onMeldung={setMeldung}
              />
            ))}
          {fremde.length === 0 && (
            <li className="text-sm text-schaum/50">Noch keine Bars in der Bibliothek.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function BarZeile({
  bar,
  eigen = false,
  userId,
  rolle,
  ausgeblendet,
  onAendern,
  onMeldung,
}: {
  bar: Bar;
  eigen?: boolean;
  userId: string | undefined;
  rolle: BenutzerRolle;
  ausgeblendet: boolean;
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
        <span className="flex items-center gap-2">
          <span className="truncate">{bar.name}</span>
          {eigen && <SichtbarkeitsChip oeffentlich={oeffentlich} />}
          {bar.gesperrt && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ziegel/20 px-2 py-0.5 text-[11px] text-ziegel">
              <IconWarnung size={11} /> gesperrt
            </span>
          )}
        </span>
        {bar.adresse && <span className="block truncate text-xs text-schaum/50">{bar.adresse}</span>}
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
