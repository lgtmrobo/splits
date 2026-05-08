import { decodePolyline } from "@/lib/strava/polyline";
import { getAllPolylines } from "@/lib/supabase/queries";
import { HeatmapMap, type HeatmapFeature } from "./heatmap-map";

export const dynamic = "force-dynamic";

// ~22 m at mid-latitudes. Coarser bucket = more chance of segments from
// different runs landing in the same cell, which is what drives the count.
const GRID = 0.0002;

function downsample(
  pts: Array<[number, number]>,
  max = 150,
): Array<[number, number]> {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.floor(i * step)]);
  return out;
}

function cellKey(lng: number, lat: number): string {
  return `${Math.floor(lng / GRID)},${Math.floor(lat / GRID)}`;
}

export default async function HeatmapPage() {
  const polylines = await getAllPolylines();

  // 1) Decode + downsample every activity into [lng, lat] arrays.
  const routes: Array<Array<[number, number]>> = [];
  for (const p of polylines) {
    const decoded = decodePolyline(p);
    if (decoded.length < 2) continue;
    const sampled = downsample(decoded);
    routes.push(sampled.map(([lat, lng]) => [lng, lat]));
  }

  // 2) Grid-bucket every point. Cell value = set of route indices that
  // touch it. Set size = how many distinct runs pass through this cell.
  const cells = new Map<string, Set<number>>();
  routes.forEach((pts, i) => {
    for (const [lng, lat] of pts) {
      const k = cellKey(lng, lat);
      let s = cells.get(k);
      if (!s) {
        s = new Set();
        cells.set(k, s);
      }
      s.add(i);
    }
  });

  // 3) Walk each route, segment by segment. Each segment gets a `count`
  // from the cell at its midpoint. Consecutive segments sharing the same
  // count are merged into a longer LineString to keep feature count low.
  const features: HeatmapFeature[] = [];
  let maxCount = 1;
  for (const pts of routes) {
    if (pts.length < 2) continue;
    let runStart = 0;
    let runCount = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const [lngA, latA] = pts[i];
      const [lngB, latB] = pts[i + 1];
      const midLng = (lngA + lngB) / 2;
      const midLat = (latA + latB) / 2;
      const c = cells.get(cellKey(midLng, midLat))?.size ?? 1;
      if (runCount === -1) runCount = c;
      if (c !== runCount) {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: pts.slice(runStart, i + 1),
          },
          properties: { count: runCount },
        });
        if (runCount > maxCount) maxCount = runCount;
        runStart = i;
        runCount = c;
      }
    }
    if (runStart < pts.length - 1 && runCount > 0) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: pts.slice(runStart) },
        properties: { count: runCount },
      });
      if (runCount > maxCount) maxCount = runCount;
    }
  }

  return (
    <div className="content fadein">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="col gap-4">
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Heatmap
          </h1>
          <div className="muted num" style={{ fontSize: 12 }}>
            {routes.length} {routes.length === 1 ? "activity" : "activities"} ·{" "}
            {features.length.toLocaleString()} segments · max overlap{" "}
            {maxCount}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <HeatmapMap features={features} maxCount={maxCount} height={680} />
      </div>
    </div>
  );
}
