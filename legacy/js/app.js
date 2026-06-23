// Haupt-App
// ──────────────────────────────────────────────────────────────

import { SUPABASE_AKTIV } from "./config.js";
import { ladeKneipen, ladeSpielformen, ladeFortschritt, speichereKneipenStand } from "./store.js";
import { spielformFuer, tourStatistik } from "./game.js";
import { initKarte, zeichneKneipen, aktualisiereMarker } from "./map.js";

let kneipen = [];
let spielformen = [];
let stand = {};        // kneipeId -> { spielformId, schlucke, erledigt }
let tourCode = "";
let aktiveKneipe = null;

// ── Tour-Code: aus URL-Hash oder neu erzeugen ─────────────────
function ermittleTourCode() {
  const ausHash = location.hash.replace("#", "").trim();
  if (ausHash) return ausHash.toUpperCase();
  const zufall = Math.random().toString(36).slice(2, 6).toUpperCase();
  const neu = `TOUR-${zufall}`;
  location.hash = neu;
  return neu;
}

// ── Start ─────────────────────────────────────────────────────
async function start() {
  tourCode = ermittleTourCode();
  document.getElementById("tourcode").textContent = tourCode;
  document.getElementById("modus").textContent =
    SUPABASE_AKTIV ? "Cloud-Speicher" : "Lokal gespeichert";

  initKarte("map");

  [kneipen, spielformen, stand] = await Promise.all([
    ladeKneipen(), ladeSpielformen(), ladeFortschritt(tourCode),
  ]);

  zeichneKneipen(kneipen, stand, oeffneKneipe);
  aktualisiereStatistik();
}

// ── Kneipe öffnen → Spielform anzeigen ────────────────────────
function oeffneKneipe(kneipe) {
  aktiveKneipe = kneipe;
  const form = spielformFuer(kneipe.id, stand, spielformen);
  const eintrag = stand[kneipe.id] || { spielformId: form.id, schlucke: 0, erledigt: false };
  // Spielform fixieren, falls neu gezogen
  eintrag.spielformId = form.id;
  stand[kneipe.id] = eintrag;

  document.getElementById("k-name").textContent = kneipe.name;
  document.getElementById("k-adresse").textContent = kneipe.adresse || "";
  document.getElementById("s-titel").textContent = form.titel;
  document.getElementById("s-text").textContent = form.beschreibung;
  document.getElementById("schluck-zahl").textContent = eintrag.schlucke;
  document.getElementById("erledigt-btn").textContent =
    eintrag.erledigt ? "Erledigt ✓" : "Als erledigt markieren";

  oeffnePanel();
}

// ── Schluck-Zähler ────────────────────────────────────────────
function aendereSchlucke(delta) {
  if (!aktiveKneipe) return;
  const e = stand[aktiveKneipe.id];
  e.schlucke = Math.max(0, e.schlucke + delta);
  document.getElementById("schluck-zahl").textContent = e.schlucke;
  sichern();
}

// ── Erledigt umschalten ───────────────────────────────────────
function toggleErledigt() {
  if (!aktiveKneipe) return;
  const e = stand[aktiveKneipe.id];
  e.erledigt = !e.erledigt;
  document.getElementById("erledigt-btn").textContent =
    e.erledigt ? "Erledigt ✓" : "Als erledigt markieren";
  aktualisiereMarker(aktiveKneipe, e.erledigt);
  sichern();
  aktualisiereStatistik();
}

async function sichern() {
  await speichereKneipenStand(tourCode, aktiveKneipe.id, stand[aktiveKneipe.id]);
}

// ── Statistik-Leiste ──────────────────────────────────────────
function aktualisiereStatistik() {
  const s = tourStatistik(stand);
  document.getElementById("stat-erledigt").textContent = `${s.erledigtAnzahl}/${kneipen.length}`;
  document.getElementById("stat-schlucke").textContent = s.schluckeGesamt;
  document.getElementById("stat-schnitt").textContent = s.schnitt;
}

// ── Panel auf/zu ──────────────────────────────────────────────
function oeffnePanel() { document.getElementById("panel").classList.add("offen"); }
function schliessePanel() { document.getElementById("panel").classList.remove("offen"); aktiveKneipe = null; }

// ── Events ────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  start();
  document.getElementById("schluck-plus").onclick  = () => aendereSchlucke(1);
  document.getElementById("schluck-minus").onclick = () => aendereSchlucke(-1);
  document.getElementById("erledigt-btn").onclick  = toggleErledigt;
  document.getElementById("panel-zu").onclick      = schliessePanel;
});
