import type { SessionPayload } from "@/lib/auth/session";

export type ListingVisibilityRefs = {
  ownerId?: string | null;
  developerUserId?: string | null;
};

/**
 * Full listing details (exact price, address, gallery, contact, etc.)
 * are available to any signed-in session, plus staff/owner/developer owner.
 */
export function canViewFullListingDetails(input: {
  session: SessionPayload | null | undefined;
  staff?: boolean | null;
  listing?: ListingVisibilityRefs | null;
}): boolean {
  if (input.staff) return true;
  if (!input.session) return false;

  const listing = input.listing;
  if (listing?.ownerId && input.session.userId === listing.ownerId) {
    return true;
  }
  if (
    listing?.developerUserId &&
    input.session.userId === listing.developerUserId
  ) {
    return true;
  }

  // Any authenticated buyer (or other role browsing while signed in).
  return true;
}

/** Cover-only photo list for anonymous teasers. */
export function teaserCoverPhotos(input: {
  coverImageUrl?: string | null;
  images?: string[];
  galleryImageUrls?: string[];
}): string[] {
  const cover =
    input.coverImageUrl ||
    input.images?.[0] ||
    input.galleryImageUrls?.[0] ||
    null;
  return cover ? [cover] : [];
}

/** Deduped full photo list for signed-in viewers. */
export function allListingPhotos(input: {
  coverImageUrl?: string | null;
  images?: string[];
  galleryImageUrls?: string[];
}): string[] {
  return [
    ...new Set(
      [
        input.coverImageUrl,
        ...(input.images ?? []),
        ...(input.galleryImageUrls ?? []),
      ].filter((url): url is string => Boolean(url)),
    ),
  ];
}
