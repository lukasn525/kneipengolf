"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/SessionProvider";
import { Button, Card, Logo, Shell } from "@/components/ui";
import { KonfigHinweis } from "@/components/KonfigHinweis";

export default function Home() {
  const { session, loading, konfiguriert } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [loading, session, router]);

  return (
    <Shell>
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo />
          </div>
          <p className="text-schaum/70">
            Spiel dich mit Freunden durch die Kneipen. An jeder Station: dein Getränk mit{" "}
            <strong>so wenig Schlücken wie möglich</strong> – aber jedes Mal in einer anderen,
            zufällig gezogenen Spielform. Gewertet wird wie beim Golf: wenig ist gut.
          </p>
        </div>

        {!konfiguriert && <KonfigHinweis />}

        <Card className="space-y-3">
          <Link href="/auth?modus=registrieren">
            <Button className="w-full">Konto erstellen</Button>
          </Link>
          <Link href="/auth?modus=login">
            <Button variant="ghost" className="w-full">
              Ich habe schon ein Konto
            </Button>
          </Link>
        </Card>

        <p className="text-center text-xs text-schaum/50">
          Spielbar auch komplett alkoholfrei – „Getränk“ ist neutral. Bitte trinkt verantwortungsvoll
          und kennt eure Grenzen. 🚱→🚰
        </p>
      </div>
    </Shell>
  );
}
