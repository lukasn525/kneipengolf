// Kartenmodul (Leaflet + OpenStreetMap)
// ──────────────────────────────────────────────────────────────
// Leaflet wird global per <script> in index.html geladen (window.L).

import { KARTE_START } from "./config.js";

let karte = null;
const marker = {}; // kneipeId -> Leaflet-Marker

// Selbstgebautes Icon, damit erledigte Kneipen anders aussehen.
function icon(erledigt) {
  return window.L.divIcon({
    className: "kneipe-pin" + (erledigt ? " erledigt" : ""),
    html: `<span><i>${erledigt ? "✓" : "🍺"}</i></span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
}

export function initKarte(elementId) {
  karte = window.L.map(elementId, { zoomControl: false })
    .setView([KARTE_START.lat, KARTE_START.lng], KARTE_START.zoom);

  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(karte);

  window.L.control.zoom({ position: "bottomright" }).addTo(karte);
  return karte;
}

export function zeichneKneipen(kneipen, stand, onClick) {
  // alte Marker entfernen
  Object.values(marker).forEach(m => karte.removeLayer(m));
  const grenzen = [];

  kneipen.forEach(k => {
    const erledigt = stand[k.id]?.erledigt === true;
    const m = window.L.marker([k.lat, k.lng], { icon: icon(erledigt) })
      .addTo(karte)
      .on("click", () => onClick(k));
    marker[k.id] = m;
    grenzen.push([k.lat, k.lng]);
  });

  if (grenzen.length) karte.fitBounds(grenzen, { padding: [60, 60] });
}

export function aktualisiereMarker(kneipe, erledigt) {
  if (marker[kneipe.id]) marker[kneipe.id].setIcon(icon(erledigt));
}
