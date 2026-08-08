import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ListingLatLng = { lat: number; lng: number };

/**
 * Batch-read PostGIS points from listings.location (mapped as Listing.geoPoint).
 */
export async function fetchListingLatLng(
  ids: string[],
): Promise<Map<string, ListingLatLng>> {
  const out = new Map<string, ListingLatLng>();
  if (ids.length === 0) return out;

  const rows = await prisma.$queryRaw<
    Array<{ id: string; lat: number | null; lng: number | null }>
  >`
    SELECT
      id,
      ST_Y("location"::geometry) AS lat,
      ST_X("location"::geometry) AS lng
    FROM "listings"
    WHERE id IN (${Prisma.join(ids)})
      AND "location" IS NOT NULL
  `;

  for (const row of rows) {
    const lat = row.lat != null ? Number(row.lat) : NaN;
    const lng = row.lng != null ? Number(row.lng) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.set(row.id, { lat, lng });
    }
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
    SET "location" = ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326),
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
