"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "./SessionProvider";
import { Shell, Logo } from "./ui";
import { KonfigHinweis } from "./KonfigHinweis";

/** Schuetzt eine Seite: nur fuer angemeldete Nutzer. */
export function Guard({ children }: { children: React.ReactNode }) {
  const { session, loading, konfiguriert } = useSession();
  const router = useRouter();
  const pfad = usePathname();

  useEffect(() => {
    if (konfiguriert && !loading && !session) {
      // Ziel merken, damit man nach dem Anmelden dort landet, wo man wollte
      // (z. B. bei einem geteilten Routen- oder Tour-Link). Die Query kommt
      // bewusst aus `window`, nicht aus `useSearchParams` – sonst müsste
      // jede geschützte Seite in eine Suspense-Grenze.
      const qs = typeof window === "undefined" ? "" : window.location.search;
      const ziel = `${pfad ?? "/dashboard"}${qs}`;
      router.replace(`/auth?modus=login&weiter=${encodeURIComponent(ziel)}`);
    }
  }, [konfiguriert, loading, session, router, pfad]);

  if (!konfiguriert) {
    return (
      <Shell>
        <div className="flex justify-center my-6">
          <Logo />
        </div>
        <KonfigHinweis />
      </Shell>
    );
  }

  if (loading || !session) {
    return (
      <Shell>
        <div className="flex-1 grid place-items-center text-schaum/60">lädt…</div>
      </Shell>
    );
  }

  return <>{children}</>;
}
