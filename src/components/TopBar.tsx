"use client";

import { useRouter } from "next/navigation";
import { Logo } from "./ui";
import { IconZahnrad } from "./Icons";

export function TopBar() {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between py-3">
      <button
        onClick={() => router.push("/dashboard")}
        className="-ml-2 flex min-h-[44px] items-center rounded-lg px-2"
        aria-label="Zum Dashboard"
      >
        <Logo klein />
      </button>
      <button
        onClick={() => router.push("/einstellungen")}
        className="grid h-11 w-11 place-items-center rounded-lg text-schaum/70 hover:bg-nacht-3 hover:text-schaum"
        aria-label="Einstellungen"
        title="Einstellungen"
      >
        <IconZahnrad />
      </button>
    </header>
  );
}
