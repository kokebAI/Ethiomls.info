/**
 * Curated Unsplash samples for listings that lack real media.
 * Stable per listing id so cards and detail stay consistent.
 */

type SampleBucket =
  | "residential"
  | "apartmentInterior"
  | "commercial"
  | "land"
  | "offPlan"
  | "buildingExterior";

const U = (id: string, w = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/** East-African / modern urban exteriors + typical MLS interiors. */
const POOLS: Record<SampleBucket, string[]> = {
  buildingExterior: [
    U("photo-1651151084802-867d6a55dd25"), // Nairobi apartments + palms
    U("photo-1672597238213-fe76a82b50cb"), // Kigali high-rise balconies
    U("photo-1662611527152-66b148bba364"), // Johannesburg housing
    U("photo-1709715739227-e4b4c2a3f3f7"), // Maputo tower
    U("photo-1545324418-cc1a3fa10c00"), // condo tower
    U("photo-1486406146926-c627a92ad1ab"), // glass commercial tower
  ],
  apartmentInterior: [
    U("photo-1502672260266-1c1ef2d93688"), // bright living room
    U("photo-1560448204-e02f11c3d0e2"), // modern flat
    U("photo-1522708323590-d24dbb6b0267"), // loft living
    U("photo-1600210492486-724fe5c67fb0"), // bedroom
    U("photo-1556912173-3bb406ef7e77"), // kitchen
    U("photo-1600607687939-ce8a6c25118c"), // living / dining
  ],
  residential: [
    U("photo-1600596542815-ffad4c1539a9"), // modern house exterior
    U("photo-1600585154340-be6161a56a0c"), // villa facade
    U("photo-1564013799919-ab600027ffc6"), // house with pool
    U("photo-1600047509807-ba8f99d36b48"), // contemporary home
  ],
  commercial: [
    U("photo-1497366216548-37526070297c"), // office interior
    U("photo-1486406146926-c627a92ad1ab"), // skyline tower
    U("photo-1693464550496-8a6b114585b8"), // Nairobi skyline
    U("photo-1497366754035-f200968a6e72"), // workspace
  ],
  land: [
    U("photo-1500382017468-9049fed747ef"), // open field
    U("photo-1464822759023-fed622ff2c3b"), // hills / plot feel
    U("photo-1470071459604-3b5ec3a7fe05"), // landscape
  ],
  offPlan: [
    U("photo-1541888946425-d81bb19240f5"), // construction site
    U("photo-1503387762-592deb58ef4e"), // building under construction
    U("photo-1672597238213-fe76a82b50cb"), // finished tower reference
    U("photo-1486406146926-c627a92ad1ab"),
  ],
};

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickFrom(pool: string[], seed: number, count: number): string[] {
  if (pool.length === 0 || count <= 0) return [];
  const start = seed % pool.length;
  const out: string[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i += 1) {
    out.push(pool[(start + i) % pool.length]!);
  }
  return out;
}

export type SamplePhotoInput = {
  id: string;
  listingType?: string | null;
  category?: string | null;
  bedrooms?: number | null;
};

/**
 * Returns sample gallery URLs when a listing has no real photos.
 * Prefer real media — only call this when `photos.length === 0`.
 */
export function sampleListingPhotos(
  input: SamplePhotoInput,
  count = 4,
): string[] {
  const seed = hashSeed(input.id);
  const category = (input.category ?? "RESIDENTIAL").toUpperCase();
  const listingType = (input.listingType ?? "SALE").toUpperCase();

  if (category === "LAND") {
    return pickFrom(POOLS.land, seed, Math.min(count, 3));
  }
  if (category === "COMMERCIAL") {
    return [
      ...pickFrom(POOLS.commercial, seed, 2),
      ...pickFrom(POOLS.buildingExterior, seed + 3, Math.max(0, count - 2)),
    ].slice(0, count);
  }
  if (listingType === "OFF_PLAN") {
    return [
      ...pickFrom(POOLS.offPlan, seed, 2),
      ...pickFrom(POOLS.apartmentInterior, seed + 5, Math.max(0, count - 2)),
    ].slice(0, count);
  }

  const beds = input.bedrooms ?? 2;
  if (beds <= 0) {
    return [
      ...pickFrom(POOLS.buildingExterior, seed, 2),
      ...pickFrom(POOLS.commercial, seed + 2, Math.max(0, count - 2)),
    ].slice(0, count);
  }

  // Typical flat / villa MLS mix: exterior cover + interiors
  return [
    ...pickFrom(POOLS.buildingExterior, seed, 1),
    ...pickFrom(POOLS.apartmentInterior, seed + 7, Math.max(0, count - 2)),
    ...pickFrom(POOLS.residential, seed + 11, 1),
  ].slice(0, count);
}

/** Cover-only fallback for directory cards. */
export function sampleListingCover(input: SamplePhotoInput): string {
  return sampleListingPhotos(input, 1)[0]!;
}
