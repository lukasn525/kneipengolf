"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "./SessionProvider";
import { Logo } from "./ui";

export function TopBar() {
  const router = useRouter();
  const { user } = useSession();

  async function abmelden() {
    await supabase().auth.signOut();
    router.replace("/");
  }

  const name = (user?.user_metadata?.display_name as string) || user?.email || "";

  return (
    <header className="flex items-center justify-between py-3">
      <button onClick={() => router.push("/dashboard")}>
        <Logo klein />
      </button>
      <div className="flex items-center gap-3 text-sm text-schaum/60">
        <span className="max-w-[120px] truncate">{name}</span>
        <button onClick={abmelden} className="hover:text-schaum underline underline-offset-2">
          abmelden
        </button>
      </div>
    </header>
  );
}
