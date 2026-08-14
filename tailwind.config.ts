import type { Config } from "tailwindcss";

/**
 * Palette „Clubhouse“ – edles Flaschengrün, Messing als einziger Akzent,
 * Creme als Schriftfarbe.
 *
 * Die alten Namen (nacht/bernstein/schaum) bleiben bestehen und tragen
 * jetzt die neuen Werte – so erbt die gesamte App das Thema, ohne dass
 * über 400 Klassennamen angefasst werden müssen. Für neuen Code stehen
 * daneben die sprechenden Aliase gruen/messing/creme.
 */
const gruen = { DEFAULT: "#0C1F16", 2: "#12291D", 3: "#1B3A29" };
const messing = "#C9A24A";
const creme = "#EEF6E6";
const moos = "#5B9C6A";
const ziegel = "#C4553C";
/** Schrift auf Messing-Flächen – dunkelgrün statt Schwarz. */
const tinte = "#0C1F16";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // bestehende Namen, neue Werte
        nacht: gruen,
        bernstein: messing,
        schaum: creme,
        ziegel,
        moos,
        // sprechende Aliase für neuen Code
        gruen,
        messing,
        creme,
        tinte,
      },
      fontFamily: {
        display: ["Newsreader", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
