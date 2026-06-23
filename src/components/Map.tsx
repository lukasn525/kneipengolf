"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
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

function FitBounds({ stops }: { stops: TourKneipe[] }) {
  const map = useMap();
  useEffect(() => {
    if (!stops.length) return;
    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [stops, map]);
  return null;
}

export default function Map({
  stops,
  erledigt,
  onPin,
  center,
  zoom = 14,
  glas = "bier",
}: {
  stops: TourKneipe[];
  erledigt: Set<string>;
  onPin: (k: TourKneipe) => void;
  center: [number, number];
  zoom?: number;
  glas?: GlasTyp;
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
      <FitBounds stops={stops} />
      {stops.map((k, i) => (
        <Marker
          key={k.id}
          position={[k.lat, k.lng]}
          icon={pinIcon(glas, erledigt.has(k.id), i + 1)}
          eventHandlers={{ click: () => onPin(k) }}
        />
      ))}
    </MapContainer>
  );
}
