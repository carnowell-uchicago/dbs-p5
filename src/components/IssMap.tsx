"use client";

import type { LatLngTuple, Map as LeafletMap, Marker, Circle, Polyline, LayerGroup } from "leaflet";
import { useEffect, useRef, useState } from "react";

export type MapCity = { id: string; name: string; lat: number; lon: number; overhead: boolean };

type Props = {
  position: { latitude: number; longitude: number; footprint_km: number } | null;
  trail: LatLngTuple[]; // oldest first
  cities: MapCity[];
  dimmed: boolean; // stale or down: show the last known position, faded
};

type Layers = {
  L: typeof import("leaflet");
  map: LeafletMap;
  marker: Marker;
  footprint: Circle;
  trail: Polyline;
  cities: LayerGroup;
};

// Split the trail where it crosses the date line (longitude jumps from +180 to -180),
// so Leaflet doesn't draw a line across the whole map.
function splitAtDateLine(points: LatLngTuple[]): LatLngTuple[][] {
  const segments: LatLngTuple[][] = [];
  let current: LatLngTuple[] = [];
  for (const point of points) {
    const last = current[current.length - 1];
    if (last && Math.abs(point[1] - last[1]) > 180) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length) segments.push(current);
  return segments;
}

export default function IssMap({ position, trail, cities, dimmed }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<Layers | null>(null);
  const [ready, setReady] = useState(false);
  const [followIss, setFollowIss] = useState(true);

  // Create the map once. Leaflet touches `window`, so it's imported here, in the browser only.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { worldCopyJump: true, minZoom: 2 }).setView([20, 0], 3);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 12,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      const footprint = L.circle([0, 0], { radius: 1, color: "#38e1ff", weight: 2, fillColor: "#38e1ff", fillOpacity: 0.12 }).addTo(map);
      const trailLine = L.polyline([], { color: "#7c3aed", weight: 3, opacity: 0.8, dashArray: "6 6" }).addTo(map);
      const cityLayer = L.layerGroup().addTo(map);
      const marker = L.marker([0, 0], {
        icon: L.divIcon({ className: "", html: '<div class="iss-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        keyboard: false,
        title: "International Space Station",
      }).addTo(map);

      // Dragging the map means "let me look around": stop following the ISS.
      map.on("dragstart", () => setFollowIss(false));

      layersRef.current = { L, map, marker, footprint, trail: trailLine, cities: cityLayer };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      layersRef.current = null;
    };
  }, []);

  // Each new position: move the marker and footprint, and pan if following.
  useEffect(() => {
    const layers = layersRef.current;
    if (!ready || !layers || !position) return;
    const here: LatLngTuple = [position.latitude, position.longitude];
    layers.marker.setLatLng(here);
    layers.footprint.setLatLng(here).setRadius((position.footprint_km / 2) * 1000); // km diameter -> m radius
    if (followIss) layers.map.panTo(here, { animate: true, duration: 1.5 });
  }, [ready, position, followIss]);

  useEffect(() => {
    const layers = layersRef.current;
    if (!ready || !layers) return;
    layers.trail.setLatLngs(splitAtDateLine(trail));
  }, [ready, trail]);

  // Pins for the cities this person follows; green while the ISS is overhead.
  useEffect(() => {
    const layers = layersRef.current;
    if (!ready || !layers) return;
    const { L } = layers;
    layers.cities.clearLayers();
    for (const city of cities) {
      L.marker([city.lat, city.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div class="city-pin${city.overhead ? " overhead" : ""}"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
        title: city.name,
      })
        .bindTooltip(city.name, { direction: "top", offset: [0, -6] })
        .addTo(layers.cities);
    }
  }, [ready, cities]);

  return (
    <div className="relative h-full min-h-[22rem] overflow-hidden rounded-2xl border border-cyan/25">
      <div
        ref={containerRef}
        className={`h-full w-full transition-[filter] duration-700 ${dimmed ? "grayscale-[70%] brightness-75" : ""}`}
        role="region"
        aria-label="Live map of the International Space Station"
      />
      {!followIss && (
        <button
          onClick={() => setFollowIss(true)}
          className="absolute right-3 bottom-3 z-[1000] rounded-full bg-space-900/90 px-4 py-2 text-sm font-semibold text-gold shadow-lg ring-1 ring-gold/50 hover:bg-space-800 focus-visible:outline-2 focus-visible:outline-gold"
        >
          ◎ Follow the ISS
        </button>
      )}
    </div>
  );
}
