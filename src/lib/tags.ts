/**
 * Vokabular der Bar-Tags – die einzige Stelle, an der die Liste steht.
 *
 * ─── Wie du die Liste änderst ────────────────────────────────────────
 *
 *  • Tag ergänzen  → eine Zeile in `TAG_GRUPPEN` einfügen. Fertig.
 *  • Tag umbenennen (nur Anzeige) → `label` ändern. `key` bleibt, damit
 *    bereits getaggte Bars weiter passen.
 *  • Tag entfernen → Zeile löschen. Bars, die ihn noch tragen, zeigen ihn
 *    ab dann gedämpft als „unbekannt" an, statt zu brechen; wer die Bar
 *    das nächste Mal bearbeitet, wird ihn beim Speichern los.
 *  • Gruppe ergänzen → Eintrag in `TAG_GRUPPEN` plus eine Zeile in
 *    `GRUPPEN_STIL` (die Farbe der Chips).
 *
 * Die Datenbank kennt das Vokabular NICHT – `bars.tags` ist ein reines
 * `text[]` mit der einzigen Regel „höchstens drei". Deshalb braucht keine
 * dieser Änderungen eine Migration und keine Deploy-Reihenfolge.
 *
 * Absichtlich kein freies Eingabefeld: bei freien Tags stehen binnen
 * Wochen „Bier", „bier" und „Bierkneipe" nebeneinander, und der Filter
 * ist wertlos.
 */

/**
 * Maximal drei Tags pro Bar. Die Grenze ist der eigentliche Trick: sie
 * zwingt zur Entscheidung. Eine Bar mit acht Tags sagt nichts mehr aus.
 */
export const MAX_TAGS = 3;

export type TagGruppenKey = "art" | "stimmung" | "praktisch";

export type TagDef = {
  /** Wert in der Datenbank. Kleinschreibung, keine Umlaute. Nie ändern. */
  key: string;
  /** Was in der App steht. Jederzeit änderbar. */
  label: string;
  /** Optionaler Halbsatz für den Tooltip, wenn das Label mehrdeutig ist. */
  hilfe?: string;
};

export type TagGruppe = {
  key: TagGruppenKey;
  label: string;
  /** Frage, die die Gruppe beantwortet – steht klein über den Chips. */
  frage: string;
  tags: TagDef[];
};

export const TAG_GRUPPEN: TagGruppe[] = [
  {
    key: "art",
    label: "Art",
    frage: "Was für ein Laden ist das?",
    tags: [
      { key: "kneipe", label: "Kneipe" },
      { key: "bar", label: "Bar" },
      { key: "cocktailbar", label: "Cocktailbar" },
      { key: "brauhaus", label: "Brauhaus" },
      { key: "biergarten", label: "Biergarten" },
      { key: "club", label: "Club" },
      { key: "spaeti", label: "Späti" },
    ],
  },
  {
    key: "stimmung",
    label: "Stimmung",
    frage: "Wie fühlt sich der Abend dort an?",
    tags: [
      { key: "gemuetlich", label: "Gemütlich" },
      { key: "laut", label: "Laut" },
      { key: "tanzen", label: "Tanzen" },
      { key: "draussen", label: "Draußen", hilfe: "Terrasse, Hof oder Bänke vor der Tür" },
      { key: "sport", label: "Sport", hilfe: "Spiele laufen auf dem Fernseher" },
    ],
  },
  {
    key: "praktisch",
    label: "Praktisch",
    frage: "Was man vorher wissen will",
    tags: [
      { key: "guenstig", label: "Günstig" },
      {
        key: "kartenzahlung",
        label: "Kartenzahlung",
        hilfe: "Karte wird akzeptiert – man muss nicht vorher zum Automaten",
      },
      { key: "spaet_auf", label: "Spät auf", hilfe: "hat nach 1 Uhr noch offen" },
    ],
  },
];

/** Chip-Farbe je Gruppe. Messing für Art, Moos für Stimmung, gedämpft für den Rest. */
const GRUPPEN_STIL: Record<TagGruppenKey, string> = {
  art: "bg-bernstein/15 text-bernstein",
  stimmung: "bg-moos/20 text-moos",
  praktisch: "bg-nacht-2 text-schaum/70",
};

/** Tag, den das Vokabular nicht (mehr) kennt: sichtbar, aber sichtbar anders. */
const STIL_UNBEKANNT = "bg-nacht-2 text-schaum/45";

// ── Nachschlagen ──────────────────────────────────────────────────

const NACH_KEY = new Map<string, { def: TagDef; gruppe: TagGruppe; rang: number }>();
TAG_GRUPPEN.forEach((g, gi) =>
  g.tags.forEach((t, ti) => NACH_KEY.set(t.key, { def: t, gruppe: g, rang: gi * 100 + ti }))
);

/** Alle Tags in der Reihenfolge, in der sie in den Gruppen stehen. */
export const ALLE_TAGS: TagDef[] = TAG_GRUPPEN.flatMap((g) => g.tags);

export function istBekannt(tag: string): boolean {
  return NACH_KEY.has(tag);
}

/** Anzeigename. Unbekannte Tags zeigen ihren rohen Wert – nie einen Absturz. */
export function tagLabel(tag: string): string {
  return NACH_KEY.get(tag)?.def.label ?? tag;
}

export function tagHilfe(tag: string): string | undefined {
  const e = NACH_KEY.get(tag);
  if (!e) return "Dieser Tag steht nicht mehr in der Liste.";
  return e.def.hilfe;
}

export function tagGruppe(tag: string): TagGruppenKey | null {
  return NACH_KEY.get(tag)?.gruppe.key ?? null;
}

export function tagStil(tag: string): string {
  const g = tagGruppe(tag);
  return g ? GRUPPEN_STIL[g] : STIL_UNBEKANNT;
}

// ── Umgang mit den Werten ─────────────────────────────────────────

/**
 * Tags einer Bar, wie sie angezeigt werden: in Vokabular-Reihenfolge,
 * Unbekanntes hinten. Verträgt `null`, `undefined` und Altbestand.
 */
export function barTags(bar: { tags?: string[] | null } | null | undefined): string[] {
  const roh = bar?.tags;
  if (!Array.isArray(roh)) return [];
  return [...new Set(roh.filter((t) => typeof t === "string" && t.trim()))].sort(
    (a, b) => (NACH_KEY.get(a)?.rang ?? 9999) - (NACH_KEY.get(b)?.rang ?? 9999)
  );
}

/**
 * Was tatsächlich gespeichert wird: doppelte raus, unbekannte raus,
 * bei `MAX_TAGS` gekappt. Spiegelt die Prüfung in der Datenbank, damit
 * ein Speichern nie an einer Regel scheitert, die die UI nicht kennt.
 */
export function tagsFuerSpeichern(tags: string[]): string[] {
  return [...new Set(tags)].filter(istBekannt).slice(0, MAX_TAGS);
}

/** Ein Tag an- oder abwählen – gibt die neue Auswahl zurück. */
export function tagUmschalten(aktuell: string[], tag: string): string[] {
  if (aktuell.includes(tag)) return aktuell.filter((t) => t !== tag);
  if (aktuell.length >= MAX_TAGS) return aktuell;
  return [...aktuell, tag];
}

/**
 * Filter-Regel: eine Bar passt, wenn sie mindestens einen der gewählten
 * Tags trägt (Überschneidung, nicht Schnittmenge). Bei höchstens drei Tags
 * pro Bar würde ein „alle müssen zutreffen" fast immer nichts finden.
 */
export function passtZuTags(bar: { tags?: string[] | null }, gewaehlt: string[]): boolean {
  if (gewaehlt.length === 0) return true;
  const eigene = barTags(bar);
  return gewaehlt.some((t) => eigene.includes(t));
}
