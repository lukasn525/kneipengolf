"use client";

import { glasInnerSvg } from "@/lib/glas";
import type { GlasTyp } from "@/lib/types";

/** Rendert ein Comic-Glas als SVG (für Auswahl-Buttons etc.). */
export function GlasIcon({ typ, size = 32 }: { typ: GlasTyp; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: glasInnerSvg(typ) }}
    />
  );
}
