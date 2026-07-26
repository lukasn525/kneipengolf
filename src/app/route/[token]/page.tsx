"use client";

/**
 * Landeseite eines geteilten Routen-Links: /route/<token>
 *
 * Der Token im Link ist das Geheimnis – wer ihn hat, sieht die Route und
 * darf sie übernehmen. Beides läuft über `security definer`-Funktionen,
 * damit dafür keine Rechte an Bars oder Routen aufgeweicht werden müssen.
 *
 * Die Vorschau funktioniert bewusst auch ohne Konto: erst zeigen, worum
 * es geht, dann zum Anmelden einladen. Nach dem Login landet man über
 * `?weiter=` wieder genau hier.
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Field, Input, Logo, Shell } from "@/components/ui";
import { KonfigHinweis } from "@/components/KonfigHinweis";
import { IconPin, IconRoute, IconUebernommen, IconWeiter } from "@/components/Icons";
import {
  eigeneRoutenNamen,
  freierRoutenName,
  routeUebernehmen,
  routeVorschau,
  type RoutenVorschau,
} from "@/lib/routen";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-schaum/40">Karte lädt…</div>
  ),
});

export default function GeteilteRoutePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading, konfiguriert } = useSession();

  const [vorschau, setVorschau] = useState<RoutenVorschau | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [meineNamen, setMeineNamen] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<{ routeId: string; name: string } | null>(null);

  useEffect(() => {
    if (!token || !konfiguriert) return;
    routeVorschau(token)
      .then((v) => setVorschau(v))
      .catch(() => setVorschau(null))
      .finally(() => setGeladen(true));
  }, [token, konfiguriert]);

  // Namensvorschlag: erst wenn beides da ist – Route und eigene Namen.
  useEffect(() => {
    if (!user || !vorschau) return;
    eigeneRoutenNamen(user.id).then((namen) => {
      setMeineNamen(namen);
      setName(freierRoutenName(vorschau.route.name, namen));
    });
  }, [user, vorschau]);

  const konflikt =
    name.trim().length > 0 &&
    meineNamen.some((n) => n.trim().toLowerCase() === name.trim().toLowerCase());

  async function uebernehmen() {
    if (!token || konflikt || !name.trim()) return;
    setBusy(true);
    setFehler(null);
    const res = await routeUebernehmen(token, name);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.meldung);
      if (res.fehler === "name_belegt") {
        // Server und Client können auseinanderlaufen (zweiter Tab):
        // Namen neu laden und einen frischen Vorschlag setzen.
        const namen = await eigeneRoutenNamen(user?.id);
        setMeineNamen(namen);
        setName(freierRoutenName(name, namen));
      }
      return;
    }
    setFertig({ routeId: res.routeId, name: res.name });
  }

  if (!konfiguriert) {
    return (
      <Shell>
        <div className="my-6 flex justify-center">
          <Logo />
        </div>
        <KonfigHinweis />
      </Shell>
    );
  }

  if (!geladen || loading) {
    return (
      <Shell>
        <TopBar />
        <div className="mt-6 space-y-3">
          <div className="kg-skeleton h-24 w-full" />
          <div className="kg-skeleton h-48 w-full" />
        </div>
      </Shell>
    );
  }

  if (!vorschau) {
    return (
      <Shell>
        <TopBar />
        <Card className="mt-6 space-y-3 text-center">
          <h1 className="font-display text-xl">Route nicht gefunden</h1>
          <p className="text-sm text-schaum/60">
            Der Link ist abgelaufen, wurde zurückgezogen oder enthält einen Tippfehler.
          </p>
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full">
              Zum Hauptmenü
            </Button>
          </Link>
        </Card>
      </Shell>
    );
  }

  const { route, stops } = vorschau;
  const center: [number, number] = stops.length
    ? [
        stops.reduce((a, s) => a + s.lat, 0) / stops.length,
        stops.reduce((a, s) => a + s.lng, 0) / stops.length,
      ]
    : [51.1657, 10.4515];

  return (
    <Shell>
      <TopBar />
      <div className="mt-2 space-y-5 pb-8">
        <Card className="space-y-2">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-bernstein">
            <IconRoute size={14} /> Geteilte Route
          </p>
          <h1 className="font-display text-2xl">{route.name}</h1>
          {route.beschreibung && <p className="text-sm text-schaum/70">{route.beschreibung}</p>}
          <p className="flex items-center gap-1.5 text-xs text-schaum/50">
            <IconPin size={12} /> {stops.length} Stops
          </p>
        </Card>

        {stops.length > 0 && (
          <div className="h-56 overflow-hidden rounded-2xl border border-[var(--linie)]">
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
              center={center}
              zoom={13}
              glas="bier"
              route
            />
          </div>
        )}

        <Card className="space-y-2">
          <h2 className="font-display text-lg">Stops</h2>
          <ol className="space-y-1.5">
            {stops.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mono w-5 shrink-0 text-right text-bernstein">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate">{s.name}</span>
                  {s.adresse && (
                    <span className="block truncate text-xs text-schaum/50">{s.adresse}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        {/* ── Übernehmen ─────────────────────────────────────────── */}
        {fertig ? (
          <Card className="space-y-3">
            <p className="text-sm">
              „{fertig.name}" liegt jetzt unter <span className="text-bernstein">Routen</span> in
              deinem Hauptmenü.
            </p>
            <Button className="w-full" onClick={() => router.push(`/create?route=${fertig.routeId}`)}>
              Direkt spielen <IconWeiter size={16} />
            </Button>
            <Link href="/dashboard?tab=routen">
              <Button variant="ghost" className="w-full">
                Zu meinen Routen
              </Button>
            </Link>
          </Card>
        ) : route.ist_eigene ? (
          <Card className="space-y-3">
            <p className="text-sm text-schaum/70">Das ist deine eigene Route.</p>
            <Link href="/dashboard?tab=routen">
              <Button variant="ghost" className="w-full">
                Zu meinen Routen
              </Button>
            </Link>
          </Card>
        ) : !user ? (
          <Card className="space-y-3">
            <p className="text-sm text-schaum/70">
              Zum Speichern brauchst du ein Konto. Danach landest du automatisch wieder hier.
            </p>
            <Link href={`/auth?modus=login&weiter=${encodeURIComponent(`/route/${token}`)}`}>
              <Button className="w-full">Anmelden & speichern</Button>
            </Link>
          </Card>
        ) : (
          <Card className="space-y-3">
            <h2 className="font-display text-lg">Zu meinen Routen hinzufügen</h2>
            <Field label="Name in deiner Liste">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {konflikt ? (
              <button
                onClick={() => setName(freierRoutenName(name, meineNamen))}
                className="text-left text-xs text-ziegel underline"
              >
                Du hast schon eine Route mit diesem Namen – „{freierRoutenName(name, meineNamen)}"
                nehmen?
              </button>
            ) : (
              <p className="text-xs text-schaum/40">
                Öffentliche Bars bleiben verlinkt, private Bars werden als eigene Kopie gespeichert
                und in „Bars" als übernommen markiert.
              </p>
            )}
            {fehler && <p className="text-sm text-ziegel">{fehler}</p>}
            <Button
              className="w-full"
              onClick={uebernehmen}
              disabled={busy || konflikt || !name.trim()}
            >
              <IconUebernommen size={16} />
              {busy ? "speichere…" : "Übernehmen"}
            </Button>
          </Card>
        )}
      </div>
    </Shell>
  );
}
