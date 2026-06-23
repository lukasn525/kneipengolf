"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True, wenn Supabase konfiguriert ist. Sonst laeuft die App im Demo-Modus. */
export const SUPABASE_AKTIV = Boolean(url && anon);

let _client: SupabaseClient | null = null;

/** Singleton-Client. Wirft nur, wenn man ihn ohne Konfiguration benutzt. */
export function supabase(): SupabaseClient {
  if (!SUPABASE_AKTIV) {
    throw new Error(
      "Supabase ist nicht konfiguriert. Bitte NEXT_PUBLIC_SUPABASE_URL und " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local bzw. in den Vercel-Env-Vars setzen."
    );
  }
  if (!_client) {
    _client = createClient(url as string, anon as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _client;
}
