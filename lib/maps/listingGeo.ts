import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ListingLatLng = { lat: number; lng: number };

/**
 * Batch-read PostGIS points from listings."geoPoint".
 * Prod schema uses the Prisma field name as the column (not "location").
 */
export async function fetchListingLatLng(
  ids: string[],
): Promise<Map<string, ListingLatLng>> {
  const out = new Map<string, ListingLatLng>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;

  try {
    // Chunk IN lists — safer for pooler / prepared-statement limits.
    const chunkSize = 100;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const rows = await prisma.$queryRaw<
        Array<{ id: string; lat: unknown; lng: unknown }>
      >`
        SELECT
          id,
          ST_Y("geoPoint"::geometry)::float8 AS lat,
          ST_X("geoPoint"::geometry)::float8 AS lng
        FROM "listings"
        WHERE id IN (${Prisma.join(chunk)})
          AND "geoPoint" IS NOT NULL
      `;

      for (const row of rows) {
        const lat = row.lat != null ? Number(row.lat) : NaN;
        const lng = row.lng != null ? Number(row.lng) : NaN;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          out.set(row.id, { lat, lng });
        }
      }
    }
  } catch (error) {
    // Map UIs fall back to sub-city centroids when GPS is unavailable.
    console.error("[listingGeo] fetchListingLatLng failed:", error);
  }
  return out;
}

export async function setListingLatLng(
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("lat and lng must be finite numbers");
  }
  await prisma.$executeRaw`
    UPDATE "listings"
    SET "geoPoint" = ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326),
        "updatedAt" = NOW()
    WHERE id = ${id}
  `;
}

export function parseOptionalGpsPair(input: {
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
}): ListingLatLng | null {
  const lat =
    input.gpsLatitude != null ? Number(input.gpsLatitude) : Number.NaN;
  const lng =
    input.gpsLongitude != null ? Number(input.gpsLongitude) : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
