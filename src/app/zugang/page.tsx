"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Field, Input, Logo, Shell } from "@/components/ui";

function ZugangInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setBusy(true);
    try {
      const res = await fetch("/api/zugang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const weiter = params.get("weiter") || "/";
        // Sicherstellen, dass wir nur zu internen Pfaden weiterleiten.
        const ziel = weiter.startsWith("/") ? weiter : "/";
        router.replace(ziel);
        router.refresh();
      } else {
        setFehler("Falscher Zugangscode.");
      }
    } catch {
      setFehler("Etwas ist schiefgelaufen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="flex-1 flex flex-col justify-center gap-5">
        <div className="flex justify-center">
          <Logo />
        </div>

        <Card className="space-y-4">
          <div className="space-y-1 text-center">
            <p className="font-semibold text-schaum">Diese Seite ist privat</p>
            <p className="text-sm text-schaum/60">
              Bitte gib den Zugangscode ein, um fortzufahren.
            </p>
          </div>

          <form onSubmit={absenden} className="space-y-3">
            <Field label="Zugangscode">
              <Input
                type="password"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Zugangscode"
              />
            </Field>

            {fehler && <p className="text-sm text-ziegel">{fehler}</p>}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "…" : "Weiter"}
            </Button>
          </form>
        </Card>
      </div>
    </Shell>
  );
}

export default function ZugangPage() {
  return (
    <Suspense fallback={null}>
      <ZugangInner />
    </Suspense>
  );
}
