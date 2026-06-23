"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TourKneipe } from "@/lib/types";

function pinIcon(nummer: number, erledigt: boolean) {
  return L.divIcon({
    className: "kneipe-pin" + (erledigt ? " erledigt" : ""),
    html: `<span><i>${erledigt ? "✓" : nummer}</i></span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
}

function FitBounds({ stops }: { stops: TourKneipe[] }) {
  const map = useMap();
  useEffect(() => {
    if (!stops.length) return;
    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [stops, map]);
  return null;
}

export default function Map({
  stops,
  erledigt,
  onPin,
  center,
  zoom = 14,
}: {
  stops: TourKneipe[];
  erledigt: Set<string>;
  onPin: (k: TourKneipe) => void;
  center: [number, number];
  zoom?: number;
}) {
  return (
    <MapContainer center={center} zoom={zoom} zoomControl={false} className="h-full w-full">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
        maxZoom={19}
      />
      <FitBounds stops={stops} />
      {stops.map((k, i) => (
        <Marker
          key={k.id}
          position={[k.lat, k.lng]}
          icon={pinIcon(i + 1, erledigt.has(k.id))}
          eventHandlers={{ click: () => onPin(k) }}
        />
      ))}
    </MapContainer>
  );
}
