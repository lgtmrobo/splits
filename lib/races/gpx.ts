// Race course from a GPX file → the encoded polyline + elevation gain we
// store on `races`. Shared by the Add race dialog and
// scripts/import-race-course-gpx.mjs. No imports, so plain Node can load it.

export interface GpxPoint {
  lat: number;
  lng: number;
  ele: number | null;
}

// Ignore elevation wiggles smaller than this so GPS noise doesn't inflate gain.
const GAIN_HYSTERESIS_M = 2;

/** Track points (<trkpt>), falling back to route points (<rtept>). */
export function parseGpx(xml: string): GpxPoint[] {
  const points = (tag: string) => {
    const re = new RegExp(
      `<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`,
      "g",
    );
    const out: GpxPoint[] = [];
    for (const m of xml.matchAll(re)) {
      const lat = m[1].match(/\blat\s*=\s*["']([-\d.]+)["']/);
      const lon = m[1].match(/\blon\s*=\s*["']([-\d.]+)["']/);
      if (!lat || !lon) continue;
      const ele = m[2]?.match(/<ele>\s*([-\d.]+)\s*<\/ele>/);
      out.push({
        lat: Number(lat[1]),
        lng: Number(lon[1]),
        ele: ele ? Number(ele[1]) : null,
      });
    }
    return out;
  };
  const track = points("trkpt");
  return track.length > 0 ? track : points("rtept");
}

/** Google encoded polyline, precision 5 — the format Strava uses. */
export function encodePolyline(points: { lat: number; lng: number }[]): string {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  const encodeValue = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const { lat, lng } of points) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    out += encodeValue(la - prevLat) + encodeValue(ln - prevLng);
    prevLat = la;
    prevLng = ln;
  }
  return out;
}

/** Total climb in meters, or null when the file has no elevation. */
export function elevationGain(points: GpxPoint[]): number | null {
  const eles = points.map((p) => p.ele).filter((e): e is number => e != null);
  if (eles.length === 0) return null;
  let gain = 0;
  let ref = eles[0];
  for (const e of eles) {
    if (e - ref >= GAIN_HYSTERESIS_M) {
      gain += e - ref;
      ref = e;
    } else if (ref - e >= GAIN_HYSTERESIS_M) {
      ref = e;
    }
  }
  return gain;
}

/** Course columns for a `races` row, or null if the file has no points. */
export function courseFromGpx(
  xml: string,
): { course_polyline: string; course_elevation_gain_m: number | null } | null {
  const points = parseGpx(xml);
  if (points.length < 2) return null;
  return {
    course_polyline: encodePolyline(points),
    course_elevation_gain_m: elevationGain(points),
  };
}
