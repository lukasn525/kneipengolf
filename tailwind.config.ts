import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nacht: { DEFAULT: "#16110d", 2: "#211913", 3: "#2c2118" },
        bernstein: "#f0a830",
        schaum: "#f7f0e1",
        ziegel: "#c2492f",
        moos: "#6b8f5e",
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
