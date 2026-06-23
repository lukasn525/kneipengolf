"use client";

import { Card } from "./ui";

/** Wird angezeigt, wenn Supabase-Env-Vars fehlen. */
export function KonfigHinweis() {
  return (
    <Card className="border-ziegel/50">
      <h2 className="font-display text-lg mb-2">⚙️ Fast fertig – Supabase fehlt noch</h2>
      <p className="text-sm text-schaum/80">
        Diese App braucht ein kostenloses Supabase-Projekt für Konten, Touren und die Live-Rangliste.
        Trage <code className="mono text-bernstein">NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
        <code className="mono text-bernstein">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
        <code className="mono">.env.local</code> (lokal) bzw. in den Vercel-Environment-Variables ein.
        Die genaue Anleitung steht im <code className="mono">README.md</code>.
      </p>
    </Card>
  );
}
