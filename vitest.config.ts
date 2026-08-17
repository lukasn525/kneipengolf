import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit-Tests für die reine Logik – kein Browser, kein Netz, keine Datenbank.
 *
 * Bewusst nur `src/lib`: Dort liegt alles, was rechnet oder entscheidet, und
 * zwar als reine Funktionen. Die React-Seiten sind 2600 Zeilen UI mit
 * Supabase-Aufrufen darin; die deckt der E2E-Test ab, nicht Vitest.
 *
 * Die RLS-Regeln testet `supabase/tests/rls_test.sql` – die gehören in die
 * Datenbank, nicht hierher.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/game.ts",
        "src/lib/tags.ts",
        "src/lib/beliebtheit.ts",
        "src/lib/orte.ts",
        "src/lib/zugangscode.ts",
      ],
      /*
       * Untergrenzen je Datei statt einer globalen Zahl.
       *
       * Eine globale Quote von „85 %" sagt wenig: Sie lässt zu, dass
       * ausgerechnet die Rechenlogik verfällt, solange woanders genug
       * abgedeckt ist. Pro Datei festgenagelt fällt der Build genau dann,
       * wenn in der betroffenen Datei ein Zweig ohne Test dazugekommen ist.
       *
       * `beliebtheit.ts` steht bewusst niedrig: Der größere Teil der Datei
       * sind Supabase-Aufrufe (`ladeBeliebtheit`, `empfehlungSetzen`). Die
       * gehören in die RLS-Tests und den E2E-Lauf, nicht hierher – ein Mock
       * des Supabase-Clients würde nur prüfen, dass der Mock funktioniert.
       */
      thresholds: {
        "src/lib/game.ts": { lines: 100, functions: 100, branches: 95 },
        "src/lib/orte.ts": { lines: 100, functions: 100, branches: 100 },
        "src/lib/zugangscode.ts": { lines: 100, functions: 100, branches: 100 },
        "src/lib/tags.ts": { lines: 95, functions: 85, branches: 95 },
        "src/lib/beliebtheit.ts": { lines: 40, functions: 60, branches: 90 },
      },
      reporter: ["text", "html"],
    },
  },
});
