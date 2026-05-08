"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface RouteMapProps {
  /** Real route coords as [lng, lat] pairs (GeoJSON order). */
  points: [number, number][];
  height?: number;
  /** Optional header pill, e.g. "Riverside loop · 8.3mi" */
  titleLabel?: string;
  /** Optional bottom-right meta, e.g. "Portland, OR · 6:02 AM" */
  metaLabel?: string;
}

const STYLE = "mapbox://styles/mapbox/dark-v11";
const ROUTE_SOURCE = "route";
const ROUTE_LAYER_GLOW = "route-glow";
const ROUTE_LAYER = "route-line";

function getBounds(
  points: [number, number][],
): [[number, number], [number, number]] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function readAccent(): string {
  if (typeof window === "undefined") return "#8EF542";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();
  return v || "#8EF542";
}

export function RouteMap({
  points,
  height = 360,
  titleLabel,
  metaLabel,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!containerRef.current || !token || points.length < 2) return;
    mapboxgl.accessToken = token;

    const accent = readAccent();
    const bounds = getBounds(points);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE,
      bounds,
      fitBoundsOptions: { padding: 32, animate: false },
      attributionControl: false,
      cooperativeGestures: false,
    });
    mapRef.current = map;

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: points },
    };

    map.on("load", () => {
      map.addSource(ROUTE_SOURCE, { type: "geojson", data: geojson });
      map.addLayer({
        id: ROUTE_LAYER_GLOW,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": accent,
          "line-width": 8,
          "line-opacity": 0.35,
          "line-blur": 6,
        },
      });
      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": accent, "line-width": 3, "line-opacity": 1 },
      });

      // Start / finish markers
      const start = points[0];
      const end = points[points.length - 1];

      const startEl = document.createElement("div");
      startEl.style.cssText = `width:12px;height:12px;border-radius:50%;background:${accent};box-shadow:0 0 0 3px rgba(142,245,66,0.25);`;
      new mapboxgl.Marker({ element: startEl })
        .setLngLat(start as [number, number])
        .addTo(map);

      const endEl = document.createElement("div");
      endEl.style.cssText = `width:12px;height:12px;border-radius:50%;background:#0A0A0C;border:2px solid ${accent};`;
      new mapboxgl.Marker({ element: endEl })
        .setLngLat(end as [number, number])
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div
        className="muted"
        style={{
          height,
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          border: "1px dashed var(--hairline)",
          borderRadius: 10,
          textAlign: "center",
          padding: 20,
        }}
      >
        Map disabled — set NEXT_PUBLIC_MAPBOX_TOKEN to enable.
      </div>
    );
  }

  return (
    <div
      className="map-frame"
      style={{ height, position: "relative", borderRadius: 10 }}
    >
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 10,
          overflow: "hidden",
        }}
      />
      {titleLabel && (
        <div style={{ position: "absolute", left: 16, top: 16, zIndex: 1 }}>
          <span className="pill accent">{titleLabel}</span>
        </div>
      )}
      {metaLabel && (
        <div
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            zIndex: 1,
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 10,
            color: "var(--text-3)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: "rgba(10,10,12,0.6)",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          {metaLabel}
        </div>
      )}
    </div>
  );
}
