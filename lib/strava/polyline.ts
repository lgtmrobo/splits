import polyline from "@mapbox/polyline";

/**
 * Decode a Google-encoded polyline (what Strava returns in
 * `map.summary_polyline`) into [lat, lng] pairs.
 */
export function decodePolyline(encoded: string): Array<[number, number]> {
  if (!encoded) return [];
  return polyline.decode(encoded) as Array<[number, number]>;
}

/**
 * Normalize a decoded polyline into [0..1, 0..1] space for rendering in a
 * box of the given aspect ratio. Preserves the route's true aspect ratio
 * (corrected for latitude — degrees of longitude shrink as you move north),
 * fitting the longest dimension to (1 − 2*padding) and centering the rest.
 */
export function normalizePoints(
  pts: Array<[number, number]>,
  opts: { aspect?: number; padding?: number } = {}
): Array<[number, number]> {
  if (pts.length === 0) return [];
  const aspect = opts.aspect ?? 1; // box width / height
  const padding = opts.padding ?? 0.04;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of pts) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  // 1° lng = cos(lat) × 1° lat in actual ground distance, so scale lng span.
  const meanLatRad = ((minLat + maxLat) / 2) * Math.PI / 180;
  const lngScale = Math.cos(meanLatRad);
  const spanLat = (maxLat - minLat) || 1e-9;
  const spanLng = ((maxLng - minLng) * lngScale) || 1e-9;

  const inner = 1 - 2 * padding;
  // The container is `aspect` wide × 1 tall in normalized [0..1] units.
  const sx = (inner * aspect) / spanLng;
  const sy = inner / spanLat;
  const s = Math.min(sx, sy);

  const wDraw = spanLng * s;
  const hDraw = spanLat * s;
  const ox = (aspect - wDraw) / 2;
  const oy = (1 - hDraw) / 2;

  // x = (lng - min) * lngScale * s, y = mirrored so north is up
  return pts.map(([lat, lng]) => [
    (ox + (lng - minLng) * lngScale * s) / aspect,
    oy + (maxLat - lat) * s,
  ]);
}
