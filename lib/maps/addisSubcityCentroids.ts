/** Approximate centroids for Addis sub-cities (pin fallback when GPS missing). */

export const ADDIS_SUBCITY_CENTROIDS: Record<
  string,
  { lat: number; lng: number }
> = {
  "addis-ketema": { lat: 9.0335, lng: 38.7245 },
  "akaky-kaliti": { lat: 8.9108, lng: 38.7612 },
  arada: { lat: 9.0345, lng: 38.7516 },
  bole: { lat: 8.9942, lng: 38.7895 },
  gullele: { lat: 9.0652, lng: 38.7258 },
  kirkos: { lat: 9.0108, lng: 38.7631 },
  "kolfe-keranio": { lat: 9.0215, lng: 38.6824 },
  lideta: { lat: 9.0102, lng: 38.7378 },
  "nifas-silk-lafto": { lat: 8.9645, lng: 38.7248 },
  yeka: { lat: 9.0228, lng: 38.8265 },
  "lemi-kura": { lat: 9.0056, lng: 38.8782 },
};

export const ADDIS_MAP_CENTER = { lat: 9.03, lng: 38.74 };
export const ADDIS_MAP_ZOOM = 12;

export function resolveListingCoordinates(input: {
  lat?: number | null;
  lng?: number | null;
  subCityCode?: string | null;
}): { lat: number; lng: number; approx: boolean } {
  const lat = input.lat != null ? Number(input.lat) : NaN;
  const lng = input.lng != null ? Number(input.lng) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, approx: false };
  }
  const code = String(input.subCityCode ?? "")
    .trim()
    .toLowerCase();
  const centroid = ADDIS_SUBCITY_CENTROIDS[code] ?? ADDIS_MAP_CENTER;
  return { lat: centroid.lat, lng: centroid.lng, approx: true };
}
