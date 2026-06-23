"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, SUPABASE_AKTIV } from "@/lib/supabaseClient";

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  konfiguriert: boolean;
};

const SessionContext = createContext<Ctx>({
  session: null,
  user: null,
  loading: true,
  konfiguriert: SUPABASE_AKTIV,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUPABASE_AKTIV) {
      setLoading(false);
      return;
    }
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, user: session?.user ?? null, loading, konfiguriert: SUPABASE_AKTIV }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
