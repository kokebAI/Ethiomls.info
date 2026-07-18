import { ConstructionStage } from "@prisma/client";

/** Human-readable labels for construction / escrow stages. */
const STAGE_LABELS: Record<ConstructionStage, string> = {
  EARTHWORKS_FOUNDATION: "Earthworks & foundation",
  SUBSTRUCTURE: "Substructure",
  SUPERSTRUCTURE: "Superstructure",
  ROOFING_ENVELOPE: "Roofing & envelope",
  MEP_INSTALLATION: "MEP installation",
  INTERIOR_FINISHING: "Interior finishing",
  EXTERNAL_WORKS: "External works",
  FULLY_COMPLETED: "Fully completed",
};

export function formatConstructionStage(
  stage: ConstructionStage | string | null | undefined,
): string {
  if (!stage) return "";
  if (stage in STAGE_LABELS) {
    return STAGE_LABELS[stage as ConstructionStage];
  }
  return stage
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
