"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/components/SessionProvider";
import { Guard } from "@/components/Guard";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Field, Input, Shell } from "@/components/ui";
import type { Tour } from "@/lib/types";

function DashboardInner() {
  const router = useRouter();
  const { user } = useSession();
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meine, setMeine] = useState<Tour[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase()
      .from("touren")
      .select("*")
      .eq("host_user_id", user.id)
      .order("erstellt_am", { ascending: false })
      .then(({ data }) => setMeine((data as Tour[]) ?? []));
  }, [user]);

  async function beitreten(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setBusy(true);
    const sauber = code.trim().toUpperCase();
    const { data, error } = await supabase()
      .from("touren")
      .select("code")
      .eq("code", sauber)
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      setFehler("Keine Tour mit diesem Code gefunden.");
      return;
    }
    router.push(`/tour/${sauber}`);
  }

  return (
    <Shell>
      <TopBar />
      <div className="space-y-5 mt-2">
        <Card className="space-y-3">
          <h2 className="font-display text-xl">Neues Spiel</h2>
          <p className="text-sm text-schaum/70">
            Stadt wählen, Kneipen-Route festlegen, Mitspieler einladen.
          </p>
          <Link href="/create">
            <Button className="w-full">Spiel erstellen</Button>
          </Link>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl">Mit Code beitreten</h2>
          <form onSubmit={beitreten} className="space-y-3">
            <Field label="Tour-Code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="z. B. KOELN-7F3K"
                className="mono uppercase"
              />
            </Field>
            {fehler && <p className="text-sm text-ziegel">{fehler}</p>}
            <Button variant="ghost" type="submit" className="w-full" disabled={busy || !code.trim()}>
              {busy ? "…" : "Beitreten"}
            </Button>
          </form>
        </Card>

        {meine.length > 0 && (
          <Card className="space-y-2">
            <h2 className="font-display text-xl">Deine Spiele</h2>
            <ul className="divide-y divide-[var(--linie)]">
              {meine.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tour/${t.code}`}
                    className="flex items-center justify-between py-3 hover:text-bernstein"
                  >
                    <span>
                      <span className="mono text-bernstein">{t.code}</span>
                      {t.name ? <span className="text-schaum/60"> · {t.name}</span> : null}
                    </span>
                    <span className="text-xs text-schaum/50">{statusLabel(t.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Shell>
  );
}

function statusLabel(s: Tour["status"]) {
  return s === "lobby" ? "Lobby" : s === "laufend" ? "läuft" : "beendet";
}

export default function DashboardPage() {
  return (
    <Guard>
      <DashboardInner />
    </Guard>
  );
}
