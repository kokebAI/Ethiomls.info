import { LandHoldType, ListingEvidenceKind, ListingType } from "@prisma/client";

/** Base org + project docs always required for developer off-plan inventory. */
export const DEVELOPER_OFFPLAN_BASE_EVIDENCE_KINDS: ListingEvidenceKind[] = [
  ListingEvidenceKind.ORG_REGISTRATION,
  ListingEvidenceKind.ORG_LICENSE,
  ListingEvidenceKind.ORG_TIN,
  ListingEvidenceKind.PROJECT_BROCHURE,
  ListingEvidenceKind.FLOOR_PLAN,
  ListingEvidenceKind.CONSTRUCTION_PERMIT,
  ListingEvidenceKind.ESCROW_PROOF,
];

/**
 * @deprecated Prefer {@link requiredEvidenceKindsForHoldType}. Kept for callers
 * that list every possible kind without hold-type context.
 */
export const DEVELOPER_OFFPLAN_EVIDENCE_KINDS: ListingEvidenceKind[] = [
  ...DEVELOPER_OFFPLAN_BASE_EVIDENCE_KINDS,
  ListingEvidenceKind.TITLE_OR_LEASE,
  ListingEvidenceKind.LEASE_AGREEMENT,
];

export const EVIDENCE_KIND_LABELS: Record<ListingEvidenceKind, string> = {
  ORG_REGISTRATION: "Business registration",
  ORG_LICENSE: "Trade / construction license",
  ORG_TIN: "TIN certificate",
  PROJECT_BROCHURE: "Project / unit brochure",
  FLOOR_PLAN: "Floor plan",
  TITLE_OR_LEASE: "Title deed (freehold)",
  LEASE_AGREEMENT: "Lease agreement (leasehold)",
  CONSTRUCTION_PERMIT: "Construction permit (MUD)",
  ESCROW_PROOF: "Bank escrow letter",
  UNIT_GALLERY: "Unit / project photo",
};

export const MIN_GALLERY_PHOTOS = 3;
export const MAX_GALLERY_PHOTOS = 12;
export const MAX_EVIDENCE_FILE_BYTES = 2.5 * 1024 * 1024;

export function requiresDeveloperFullPack(input: {
  role?: string | null;
  listingType: ListingType | string;
}): boolean {
  return (
    input.role === "CORPORATE_DEVELOPER" &&
    input.listingType === ListingType.OFF_PLAN
  );
}

/** Document kinds required for the given land hold type. */
export function requiredEvidenceKindsForHoldType(opts: {
  holdType: LandHoldType | string;
  skipTin?: boolean;
}): ListingEvidenceKind[] {
  const hold =
    opts.holdType === LandHoldType.LEASEHOLD || opts.holdType === "LEASEHOLD"
      ? LandHoldType.LEASEHOLD
      : LandHoldType.FREEHOLD;

  const kinds = DEVELOPER_OFFPLAN_BASE_EVIDENCE_KINDS.filter((kind) => {
    if (opts.skipTin && kind === ListingEvidenceKind.ORG_TIN) return false;
    return true;
  });

  if (hold === LandHoldType.LEASEHOLD) {
    kinds.push(ListingEvidenceKind.LEASE_AGREEMENT);
  } else {
    kinds.push(ListingEvidenceKind.TITLE_OR_LEASE);
  }

  return kinds;
}

export function missingEvidenceKinds(
  present: ListingEvidenceKind[],
  opts?: {
    skipTin?: boolean;
    holdType?: LandHoldType | string | null;
  },
): ListingEvidenceKind[] {
  const required = requiredEvidenceKindsForHoldType({
    holdType: opts?.holdType ?? LandHoldType.FREEHOLD,
    skipTin: opts?.skipTin,
  });
  const set = new Set(present);
  return required.filter((kind) => !set.has(kind));
}

export function isLiveFaydaConfigured(): boolean {
  return Boolean(process.env.FAYDA_CLIENT_ID?.trim());
}
