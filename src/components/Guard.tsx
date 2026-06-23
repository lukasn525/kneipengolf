"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./SessionProvider";
import { Shell, Logo } from "./ui";
import { KonfigHinweis } from "./KonfigHinweis";

/** Schuetzt eine Seite: nur fuer angemeldete Nutzer. */
export function Guard({ children }: { children: React.ReactNode }) {
  const { session, loading, konfiguriert } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (konfiguriert && !loading && !session) router.replace("/auth?modus=login");
  }, [konfiguriert, loading, session, router]);

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
        <div className="flex-1 grid place-items-center text-schaum/50">lädt…</div>
      </Shell>
    );
  }

  return <>{children}</>;
}
