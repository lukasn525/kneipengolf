"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TourKneipe, GlasTyp } from "@/lib/types";
import { glasInnerSvg } from "@/lib/glas";

function pinHtml(glas: GlasTyp, erledigt: boolean, nummer: number): string {
  const id = `${nummer}-${erledigt ? "d" : "o"}`;
  const dropTop = erledigt ? "#86b06f" : "#f6b943";
  const dropBot = erledigt ? "#5d8050" : "#e0902a";
  const badgeBg = erledigt ? "#46663a" : "#2a1d0a";
  const badge = erledigt ? "✓" : String(nummer);
  return `
  <svg width="44" height="56" viewBox="0 0 44 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="drop${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${dropTop}"/>
        <stop offset="1" stop-color="${dropBot}"/>
      </linearGradient>
    </defs>
    <ellipse cx="22" cy="53" rx="7" ry="2.4" fill="rgba(0,0,0,.35)"/>
    <path d="M22 3 C12.6 3 5 10.6 5 20 C5 32 22 51 22 51 C22 51 39 32 39 20 C39 10.6 31.4 3 22 3 Z"
          fill="url(#drop${id})" stroke="#2a1d0a" stroke-width="2"/>
    <circle cx="22" cy="20" r="12" fill="#f7f0e1" stroke="#2a1d0a" stroke-width="1.5"/>
    <g transform="translate(10,8)">${glasInnerSvg(glas)}</g>
    <g>
      <circle cx="34" cy="9" r="7.5" fill="${badgeBg}" stroke="#f7f0e1" stroke-width="1.5"/>
      <text x="34" y="9" text-anchor="middle" dominant-baseline="central"
            font-family="'Space Mono', monospace" font-size="9" font-weight="700" fill="#f7f0e1">${badge}</text>
    </g>
  </svg>`;
}

function pinIcon(glas: GlasTyp, erledigt: boolean, nummer: number) {
  return L.divIcon({
    className: "kneipe-pin",
    html: pinHtml(glas, erledigt, nummer),
    iconSize: [44, 56],
    iconAnchor: [22, 54],
    popupAnchor: [0, -50],
  });
}

// Vorschau-/Bearbeitungs-Pin (noch nicht bestätigter Stop, verschiebbar)
function pendingIcon() {
  const html = `
  <svg width="46" height="58" viewBox="0 0 46 58" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="23" cy="55" rx="7" ry="2.4" fill="rgba(0,0,0,.35)"/>
    <path d="M23 3 C13 3 5 11 5 21 C5 33 23 53 23 53 C23 53 41 33 41 21 C41 11 33 3 23 3 Z"
          fill="#f6b943" stroke="#2a1d0a" stroke-width="2"/>
    <circle cx="23" cy="21" r="11" fill="#2a1d0a"/>
    <text x="23" y="21" text-anchor="middle" dominant-baseline="central"
          font-size="15" font-weight="800" fill="#f6b943">+</text>
  </svg>`;
  return L.divIcon({
    className: "kneipe-pin kneipe-pin-pending",
    html,
    iconSize: [46, 58],
    iconAnchor: [23, 56],
  });
}

function FitBounds({
  stops,
  pending,
}: {
  stops: TourKneipe[];
  pending?: [number, number] | null;
}) {
  const map = useMap();
  // Signatur nur aus Stop-Koordinaten -> refit nur wenn sich Stops ändern,
  // nicht bei jedem Render oder beim Verschieben des Pending-Pins.
  const sig = stops.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join("|");
  useEffect(() => {
    const pts = stops.map((s) => [s.lat, s.lng] as [number, number]);
    if (pts.length === 0 && pending) {
      map.setView(pending, Math.max(map.getZoom(), 15));
      return;
    }
    if (pts.length === 0) return;
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return null;
}

function FlyTo({ ziel }: { ziel?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (ziel) map.flyTo(ziel, Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [ziel, map]);
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function Map({
  stops,
  erledigt,
  onPin,
  center,
  zoom = 14,
  glas = "bier",
  route = false,
  routeCoords,
  onMapClick,
  pending,
  onPendingMove,
  flyTo,
}: {
  stops: TourKneipe[];
  erledigt: Set<string>;
  onPin: (k: TourKneipe) => void;
  center: [number, number];
  zoom?: number;
  glas?: GlasTyp;
  /** gestrichelte Luftlinie in Stop-Reihenfolge (Fallback ohne echte Route) */
  route?: boolean;
  /** echte, straßenfolgende Route als [lat,lng]-Punkte */
  routeCoords?: [number, number][];
  /** Tippen auf die Karte -> Koordinaten */
  onMapClick?: (lat: number, lng: number) => void;
  /** noch nicht bestätigter Pin [lat,lng] */
  pending?: [number, number] | null;
  /** Pin wurde verschoben */
  onPendingMove?: (lat: number, lng: number) => void;
  /** sanft dorthin schwenken, wenn gesetzt */
  flyTo?: [number, number] | null;
}) {
  return (
    <MapContainer center={center} zoom={zoom} zoomControl={false} className="h-full w-full">
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
        detectRetina
      />
      <FitBounds stops={stops} pending={pending} />
      <FlyTo ziel={flyTo} />
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}

      {routeCoords && routeCoords.length > 1 ? (
        <>
          {/* dezenter Schein unter der Linie für bessere Lesbarkeit */}
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "#000000", weight: 9, opacity: 0.25 }}
          />
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "#f6b943", weight: 5, opacity: 0.95, lineJoin: "round", lineCap: "round" }}
          />
        </>
      ) : route && stops.length > 1 ? (
        <Polyline
          positions={stops.map((s) => [s.lat, s.lng] as [number, number])}
          pathOptions={{ color: "#f6b943", weight: 3, opacity: 0.55, dashArray: "6 8" }}
        />
      ) : null}

      {stops.map((k, i) => (
        <Marker
          key={k.id}
          position={[k.lat, k.lng]}
          icon={pinIcon(glas, erledigt.has(k.id), i + 1)}
          eventHandlers={{ click: () => onPin(k) }}
        />
      ))}

      {pending && (
        <Marker
          position={pending}
          icon={pendingIcon()}
          draggable={Boolean(onPendingMove)}
          zIndexOffset={1000}
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const ll = m.getLatLng();
              onPendingMove?.(ll.lat, ll.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
