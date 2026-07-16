"use client";

import { useRouter } from "next/navigation";
import { Logo } from "./ui";

export function TopBar() {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between py-3">
      <button onClick={() => router.push("/dashboard")} aria-label="Zum Dashboard">
        <Logo klein />
      </button>
      <button
        onClick={() => router.push("/einstellungen")}
        className="grid h-9 w-9 place-items-center rounded-lg text-lg text-schaum/70 hover:bg-nacht-3 hover:text-schaum"
        aria-label="Einstellungen"
        title="Einstellungen"
      >
        ⚙
      </button>
    </header>
  );
}
