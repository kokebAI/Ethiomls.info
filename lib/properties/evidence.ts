import { ListingEvidenceKind, ListingType } from "@prisma/client";

/** Document kinds required for developer off-plan / unfinished inventory. */
export const DEVELOPER_OFFPLAN_EVIDENCE_KINDS: ListingEvidenceKind[] = [
  ListingEvidenceKind.ORG_REGISTRATION,
  ListingEvidenceKind.ORG_LICENSE,
  ListingEvidenceKind.ORG_TIN,
  ListingEvidenceKind.PROJECT_BROCHURE,
  ListingEvidenceKind.FLOOR_PLAN,
  ListingEvidenceKind.TITLE_OR_LEASE,
  ListingEvidenceKind.CONSTRUCTION_PERMIT,
  ListingEvidenceKind.ESCROW_PROOF,
];

export const EVIDENCE_KIND_LABELS: Record<ListingEvidenceKind, string> = {
  ORG_REGISTRATION: "Business registration",
  ORG_LICENSE: "Trade / construction license",
  ORG_TIN: "TIN certificate",
  PROJECT_BROCHURE: "Project / unit brochure",
  FLOOR_PLAN: "Floor plan",
  TITLE_OR_LEASE: "Title deed or lease / landholding",
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

export function missingEvidenceKinds(
  present: ListingEvidenceKind[],
  opts?: { skipTin?: boolean },
): ListingEvidenceKind[] {
  const required = DEVELOPER_OFFPLAN_EVIDENCE_KINDS.filter((kind) => {
    if (opts?.skipTin && kind === ListingEvidenceKind.ORG_TIN) return false;
    return true;
  });
  const set = new Set(present);
  return required.filter((kind) => !set.has(kind));
}

export function isLiveFaydaConfigured(): boolean {
  return Boolean(process.env.FAYDA_CLIENT_ID?.trim());
}
