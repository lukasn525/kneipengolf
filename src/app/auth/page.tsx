"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, SUPABASE_AKTIV } from "@/lib/supabaseClient";
import { Button, Card, Field, Input, Logo, Shell } from "@/components/ui";
import { KonfigHinweis } from "@/components/KonfigHinweis";

function AuthInner() {
  const params = useSearchParams();
  const router = useRouter();
  const startModus = params.get("modus") === "registrieren" ? "registrieren" : "login";
  const [modus, setModus] = useState<"login" | "registrieren">(startModus);
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!SUPABASE_AKTIV) {
    return (
      <Shell>
        <div className="flex justify-center my-6">
          <Logo />
        </div>
        <KonfigHinweis />
      </Shell>
    );
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setInfo(null);
    setBusy(true);
    const sb = supabase();
    try {
      if (modus === "registrieren") {
        const { data, error } = await sb.auth.signUp({
          email,
          password: passwort,
          options: { data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
        } else {
          setInfo(
            "Konto angelegt. Falls E-Mail-Bestätigung aktiv ist, bestätige bitte den Link in deiner Mail und melde dich dann an."
          );
          setModus("login");
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: passwort });
        if (error) throw error;
        router.replace("/dashboard");
      }
    } catch (err: any) {
      setFehler(err?.message ?? "Etwas ist schiefgelaufen.");
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

        <Card>
          <div className="grid grid-cols-2 gap-1 mb-4 p-1 rounded-xl bg-nacht-3">
            {(["login", "registrieren"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModus(m)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  modus === m ? "bg-bernstein text-[#2a1d0a]" : "text-schaum/70"
                }`}
              >
                {m === "login" ? "Anmelden" : "Registrieren"}
              </button>
            ))}
          </div>

          <form onSubmit={absenden} className="space-y-3">
            {modus === "registrieren" && (
              <Field label="Anzeigename (optional)">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Lukas" />
              </Field>
            )}
            <Field label="E-Mail">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@example.com"
              />
            </Field>
            <Field label="Passwort">
              <Input
                type="password"
                required
                minLength={6}
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                placeholder="mindestens 6 Zeichen"
              />
            </Field>

            {fehler && <p className="text-sm text-ziegel">{fehler}</p>}
            {info && <p className="text-sm text-moos">{info}</p>}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "…" : modus === "login" ? "Anmelden" : "Konto erstellen"}
            </Button>
          </form>
        </Card>

        <Link href="/" className="text-center text-sm text-schaum/50 hover:text-schaum">
          ← zurück
        </Link>
      </div>
    </Shell>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthInner />
    </Suspense>
  );
}
