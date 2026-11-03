"use client";

import type { LatLngTuple, Map as LeafletMap, Marker, Circle, Polyline, LayerGroup } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { predict, type Fix } from "@/lib/predict";

export type MapCity = { id: string; name: string; lat: number; lon: number; overhead: boolean };

type Props = {
  position: (Fix & { footprint_km: number }) | null; // newest real position
  previous: Fix | null; // the one before it, for the velocity
  trail: LatLngTuple[]; // oldest first
  cities: MapCity[];
  live: boolean; // fresh data: predict between updates. Stale/down: freeze and fade.
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

export default function IssMap({ position, previous, trail, cities, live }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<Layers | null>(null);
  const [ready, setReady] = useState(false);
  const [followIss, setFollowIss] = useState(true);
  const followRef = useRef(followIss);
  useEffect(() => {
    followRef.current = followIss;
  }, [followIss]);

  // Create the map once. Leaflet touches `window`, so it's imported here, in the browser only.
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { worldCopyJump: true, minZoom: 2 }).setView([20, 0], 3);
      // Esri World Street Map: keyless raster tiles. (CARTO now requires an API key.)
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 12,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS",
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

    // Leaflet only loads tiles for the size it thinks it is. Tell it whenever the
    // box changes (window resize, panel growing), or new areas stay gray.
    const observer = new ResizeObserver(() => layersRef.current?.map.invalidateSize());
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelled = true;
      observer.disconnect();
      map?.remove();
      layersRef.current = null;
    };
  }, []);

  // Move the marker and footprint. While the data is live, an animation loop
  // dead-reckons between the 10 s updates (predict()), so the ISS glides instead
  // of jumping. When data is stale or down, it stays frozen at the last real fix.
  useEffect(() => {
    const layers = layersRef.current;
    if (!ready || !layers || !position) return;
    layers.footprint.setRadius((position.footprint_km / 2) * 1000); // km diameter -> m radius

    const receivedAt = performance.now();
    let frame = 0;
    let lastDraw = 0;
    const draw = (t: number) => {
      if (t - lastDraw >= 50) { // ~20 updates a second is plenty smooth
        lastDraw = t;
        const guess = live ? predict(previous, position, (t - receivedAt) / 1000) : null;
        const here: LatLngTuple = guess ? [guess.latitude, guess.longitude] : [position.latitude, position.longitude];
        layers.marker.setLatLng(here);
        layers.footprint.setLatLng(here);
        if (followRef.current) layers.map.panTo(here, { animate: false });
      }
      if (live) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [ready, position, previous, live]);

  // Re-centre right away when the user turns following back on.
  useEffect(() => {
    const layers = layersRef.current;
    if (followIss && layers) layers.map.panTo(layers.marker.getLatLng(), { animate: true });
  }, [followIss]);

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
    <div className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-cyan/25">
      <div
        ref={containerRef}
        className={`h-full w-full transition-[filter] duration-700 ${live ? "" : "grayscale-[70%] brightness-75"}`}
        role="region"
        aria-label="Live map of the International Space Station"
      />
      <ul
        aria-label="Map legend"
        className="pointer-events-none absolute bottom-3 left-3 z-[1000] space-y-1 rounded-xl bg-space-900/85 px-3 py-2 text-xs text-star shadow-lg ring-1 ring-cyan/30"
      >
        <li className="flex items-center gap-2"><span className="iss-marker !size-3 !border-2 !animate-none" aria-hidden /> ISS{live ? " (smoothed between updates)" : ", last known position"}</li>
        <li className="flex items-center gap-2"><span className="inline-block size-3 rounded-full border-2 border-cyan bg-cyan/20" aria-hidden /> Visible from here (ISS above the horizon)</li>
        <li className="flex items-center gap-2"><span className="inline-block h-0 w-3 border-t-2 border-dashed border-[#7c3aed]" aria-hidden /> Path, last hour</li>
        <li className="flex items-center gap-2"><span className="city-pin !size-2.5" aria-hidden /> Your cities <span className="city-pin overhead !size-2.5" aria-hidden /> overhead</li>
      </ul>
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
