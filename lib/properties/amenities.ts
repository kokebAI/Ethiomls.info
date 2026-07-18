/**
 * Canonical listing amenity flags and helpers for seed / scrape / UI.
 */

export type ListingAmenityFlags = {
  waterAvailable: boolean;
  powerBackup: boolean;
  gatedCompound: boolean;
  parking: boolean;
  elevator: boolean;
  furnished: boolean;
  escrowVerified: boolean;
};

const EMPTY_FLAGS: ListingAmenityFlags = {
  waterAvailable: false,
  powerBackup: false,
  gatedCompound: false,
  parking: false,
  elevator: false,
  furnished: false,
  escrowVerified: false,
};

/** Normalize a free-form amenity token (e.g. "power-backup", "Power Backup"). */
function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
}

/**
 * Derive amenity booleans from tag lists such as `["parking", "amenity:elevator"]`.
 */
export function amenityFlagsFromTags(
  tags: readonly string[] | null | undefined,
): ListingAmenityFlags {
  const flags = { ...EMPTY_FLAGS };
  if (!tags?.length) return flags;

  for (const tag of tags) {
    const raw = tag.trim();
    if (!raw) continue;
    const token = normalizeToken(
      raw.startsWith("amenity:") ? raw.slice("amenity:".length) : raw,
    );

    switch (token) {
      case "water":
        flags.waterAvailable = true;
        break;
      case "power-backup":
      case "powerbackup":
      case "backup-power":
        flags.powerBackup = true;
        break;
      case "gated":
      case "gated-compound":
      case "security":
        flags.gatedCompound = true;
        break;
      case "parking":
        flags.parking = true;
        break;
      case "elevator":
      case "lift":
        flags.elevator = true;
        break;
      case "furnished":
        flags.furnished = true;
        break;
      case "escrow":
      case "escrow-verified":
        flags.escrowVerified = true;
        break;
      default:
        break;
    }
  }

  return flags;
}

/** Stable slug list for walkthrough config / metadata from boolean flags. */
export function amenitySlugsFromFlags(
  flags: Partial<ListingAmenityFlags>,
): string[] {
  const slugs: string[] = [];
  if (flags.waterAvailable) slugs.push("water");
  if (flags.powerBackup) slugs.push("power-backup");
  if (flags.gatedCompound) slugs.push("gated-compound");
  if (flags.parking) slugs.push("parking");
  if (flags.elevator) slugs.push("elevator");
  if (flags.furnished) slugs.push("furnished");
  if (flags.escrowVerified) slugs.push("escrow");
  return slugs;
}
