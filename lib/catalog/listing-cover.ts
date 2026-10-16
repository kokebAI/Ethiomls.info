import { sampleListingCover } from "@/lib/properties/sample-photos";

/** Generic seed placeholder used when listings had no real media. */
const WEAK_STOCK_MARKERS = [
  "photo-1560518883-ce09059eeffa", // prisma seed single-stock cover
];

export function isWeakListingCover(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  const lower = url.toLowerCase();
  return WEAK_STOCK_MARKERS.some((m) => lower.includes(m));
}

/**
 * Prefer real cover/gallery URLs; fall back to curated sample so cards never
 * render as an empty dark plane.
 */
export function resolveListingCoverUrl(input: {
  id: string;
  listingType?: string | null;
  category?: string | null;
  bedrooms?: number | null;
  coverImageUrl?: string | null;
  images?: string[] | null;
  galleryImageUrls?: string[] | null;
}): string {
  const candidates = [
    input.coverImageUrl,
    ...(input.images ?? []),
    ...(input.galleryImageUrls ?? []),
  ]
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);

  const real = candidates.find((u) => !isWeakListingCover(u));
  if (real) return real;

  return sampleListingCover({
    id: input.id,
    listingType: input.listingType,
    category: input.category,
    bedrooms: input.bedrooms,
  });
}
