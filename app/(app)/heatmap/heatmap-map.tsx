"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type HeatmapFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  { count: number }
>;

interface HeatmapMapProps {
  features: HeatmapFeature[];
  /** Highest count seen across all segments — used to scale the ramp. */
  maxCount: number;
  height?: number;
}

const STYLE = "mapbox://styles/mapbox/dark-v11";
const SOURCE_ID = "heatmap-lines";
const LAYER_GLOW = "heatmap-glow";
const LAYER_LINE = "heatmap-line";

function getBounds(
  features: HeatmapFeature[],
): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let any = false;
  for (const f of features) {
    for (const [lng, lat] of f.geometry.coordinates) {
      any = true;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!any) return null;
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

export function HeatmapMap({
  features,
  maxCount,
  height = 680,
}: HeatmapMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!containerRef.current || !token || features.length === 0) return;
    mapboxgl.accessToken = token;

    const accent = readAccent();
    const bounds = getBounds(features);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE,
      bounds: bounds ?? undefined,
      fitBoundsOptions: { padding: 40, animate: false },
      attributionControl: false,
      cooperativeGestures: false,
    });
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    const geojson: GeoJSON.FeatureCollection<
      GeoJSON.LineString,
      { count: number }
    > = { type: "FeatureCollection", features };

    // Cap the ramp top at maxCount so the brightest segments hit full
    // intensity even when the user hasn't been running the same loop 50
    // times yet. Floor at 5 so a brand-new dataset still has a usable
    // gradient (otherwise everything is "max" relative to a max of 1).
    const top = Math.max(maxCount, 5);
    const mid = Math.max(2, Math.round(top * 0.4));

    map.on("load", () => {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });

      // Glow only for hot segments — keeps single-pass roads clean.
      map.addLayer({
        id: LAYER_GLOW,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": accent,
          "line-blur": 3,
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            1,
            0,
            mid,
            0.18,
            top,
            0.55,
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            2,
            12,
            5,
            16,
            10,
            20,
            18,
          ],
        },
      });

      // Crisp top stroke. Width grows with zoom; opacity grows with count.
      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": accent,
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            1,
            0.4,
            mid,
            0.7,
            top,
            1.0,
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.6,
            12,
            1.4,
            16,
            2.6,
            20,
            5,
          ],
        },
      });
    });

    return () => {
      map.remove();
    };
  }, [features, maxCount]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div
        className="muted"
        style={{
          height,
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          textAlign: "center",
          padding: 20,
        }}
      >
        Map disabled — set NEXT_PUBLIC_MAPBOX_TOKEN to enable.
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div
        className="muted"
        style={{
          height,
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          textAlign: "center",
          padding: 20,
        }}
      >
        No GPS data yet — sync some activities first.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", position: "relative" }}
    />
  );
}
