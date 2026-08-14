"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { IconKarte, IconRoute, IconSammlung, IconProfil } from "./Icons";

/**
 * Feste Navigationsleiste am unteren Rand.
 *
 * Bewusst unten statt oben: die App wird einhändig im Stehen bedient, oft
 * mit einem Glas in der anderen Hand – der obere Bildschirmrand ist mit dem
 * Daumen kaum erreichbar. Vier Punkte, jeder mindestens 56 px hoch.
 *
 * Die Rangliste gehört bewusst NICHT hierher: sie hängt an einer laufenden
 * Tour, nicht an der App. Sie bleibt ein Reiter innerhalb der Tour.
 */
const PUNKTE = [
  { href: "/dashboard", tab: null, label: "Spielen", Icon: IconKarte },
  { href: "/dashboard?tab=routen", tab: "routen", label: "Routen", Icon: IconRoute },
  { href: "/dashboard?tab=sammlung", tab: "sammlung", label: "Sammlung", Icon: IconSammlung },
  { href: "/profil", tab: null, label: "Profil", Icon: IconProfil },
] as const;

function BottomNavInner() {
  const pfad = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab");

  function istAktiv(p: (typeof PUNKTE)[number]) {
    if (p.href === "/profil") return pfad === "/profil";
    if (pfad !== "/dashboard") return false;
    return p.tab === null ? tab === null : tab === p.tab;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-[var(--linie)] bg-nacht/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Hauptnavigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 pb-2 pt-1">
        {PUNKTE.map((p) => {
          const aktiv = istAktiv(p);
          return (
            <Link
              key={p.label}
              href={p.href}
              aria-current={aktiv ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] transition ${
                aktiv ? "text-bernstein" : "text-schaum/55 hover:text-schaum"
              }`}
            >
              <p.Icon size={21} />
              <span>{p.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}

/** Freiraum, damit Inhalt nicht unter der Leiste verschwindet. */
export function BottomNavAbstand() {
  return <div aria-hidden className="h-[84px]" />;
}
