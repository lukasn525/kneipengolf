"use client";

/**
 * Darstellung und Auswahl der Bar-Tags.
 *
 * Das Vokabular steht in `src/lib/tags.ts` – hier steht nur, wie es
 * aussieht. Eine Liste ändern heißt also: dort eine Zeile, hier nichts.
 */

import {
  MAX_TAGS,
  TAG_GRUPPEN,
  barTags,
  tagHilfe,
  tagLabel,
  tagStil,
  tagUmschalten,
} from "@/lib/tags";

/** Ein einzelner Tag als stille Marke – auf Karten und in Listen. */
export function TagChip({ tag }: { tag: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] ${tagStil(tag)}`}
      title={tagHilfe(tag)}
    >
      {tagLabel(tag)}
    </span>
  );
}

/**
 * Die Tags einer Bar. Ohne Tags kommt nichts – eine leere Zeile wäre
 * ein stiller Vorwurf, und ungetaggte Bars sind ausdrücklich in Ordnung.
 */
export function TagListe({ bar }: { bar: { tags?: string[] | null } }) {
  const tags = barTags(bar);
  if (tags.length === 0) return null;
  return (
    <>
      {tags.map((t) => (
        <TagChip key={t} tag={t} />
      ))}
    </>
  );
}

/**
 * Auswahl beim Anlegen und Bearbeiten.
 *
 * Ist das Maximum erreicht, werden die übrigen Chips blass statt zu
 * verschwinden: man sieht, was man aufgeben müsste, statt vor einer
 * geschrumpften Liste zu stehen.
 */
export function TagWahl({
  wert,
  onChange,
}: {
  wert: string[];
  onChange: (tags: string[]) => void;
}) {
  const voll = wert.length >= MAX_TAGS;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-schaum/70">Tags</span>
        <span className={`text-xs ${voll ? "text-bernstein" : "text-schaum/55"}`}>
          {wert.length} von {MAX_TAGS}
        </span>
      </div>

      {TAG_GRUPPEN.map((g) => (
        <div key={g.key} className="space-y-1.5">
          <p className="text-xs text-schaum/55">{g.frage}</p>
          <div className="flex flex-wrap gap-2">
            {g.tags.map((t) => {
              const aktiv = wert.includes(t.key);
              const blass = voll && !aktiv;
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={aktiv}
                  title={blass ? `Erst einen Tag abwählen – ${MAX_TAGS} sind vergeben.` : t.hilfe}
                  onClick={() => onChange(tagUmschalten(wert, t.key))}
                  className={`min-h-[40px] rounded-full border px-3 py-1.5 text-sm transition ${
                    aktiv
                      ? "border-bernstein bg-bernstein/15"
                      : blass
                        ? "border-[var(--linie)] bg-nacht-2 text-schaum/30"
                        : "border-[var(--linie)] bg-nacht-2 text-schaum/70 hover:text-schaum"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-schaum/55">
        Höchstens {MAX_TAGS} – meist einer je Zeile. Lieber gar kein Tag als ein falscher.
      </p>
    </div>
  );
}

/**
 * Filterzeile. `anzahlFuer` kommt von außen, damit hier keine Annahme
 * darüber steckt, welche Liste gerade gefiltert wird.
 *
 * Tags ohne Treffer stehen erst gar nicht in der Zeile: eine Reihe aus
 * fünfzehn Chips, von denen zwölf ins Leere führen, filtert nicht,
 * sondern verdeckt.
 */
export function TagFilter({
  gewaehlt,
  onChange,
  anzahlFuer,
  ohneAnzahl,
  ohneAktiv,
  onOhne,
}: {
  gewaehlt: string[];
  onChange: (tags: string[]) => void;
  anzahlFuer: (tag: string) => number;
  ohneAnzahl?: number;
  ohneAktiv?: boolean;
  onOhne?: () => void;
}) {
  const sichtbar = TAG_GRUPPEN.flatMap((g) => g.tags).filter(
    (t) => anzahlFuer(t.key) > 0 || gewaehlt.includes(t.key)
  );
  if (sichtbar.length === 0 && !ohneAnzahl) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sichtbar.map((t) => {
        const aktiv = gewaehlt.includes(t.key);
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={aktiv}
            title={t.hilfe}
            onClick={() =>
              onChange(aktiv ? gewaehlt.filter((x) => x !== t.key) : [...gewaehlt, t.key])
            }
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
              aktiv
                ? "border-bernstein bg-bernstein/15"
                : "border-[var(--linie)] bg-nacht-2 text-schaum/60 hover:text-schaum"
            }`}
          >
            {t.label}
            <span className={`text-xs ${aktiv ? "text-bernstein" : "text-schaum/55"}`}>
              {anzahlFuer(t.key)}
            </span>
          </button>
        );
      })}

      {/* Macht den ungetaggten Bestand auffindbar, statt ihn zu verstecken. */}
      {onOhne && !!ohneAnzahl && (
        <button
          type="button"
          aria-pressed={!!ohneAktiv}
          onClick={onOhne}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm transition ${
            ohneAktiv
              ? "border-bernstein bg-bernstein/15"
              : "border-[var(--linie)] bg-nacht-2 text-schaum/60 hover:text-schaum"
          }`}
        >
          ohne Tags
          <span className={`text-xs ${ohneAktiv ? "text-bernstein" : "text-schaum/55"}`}>
            {ohneAnzahl}
          </span>
        </button>
      )}

      {gewaehlt.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-schaum/55 hover:text-bernstein"
        >
          zurücksetzen
        </button>
      )}
    </div>
  );
}
