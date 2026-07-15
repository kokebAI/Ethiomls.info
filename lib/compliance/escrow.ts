import { ConstructionStage, ListingType } from "@prisma/client";
import {
  EscrowComplianceException,
  type EscrowComplianceIssue,
} from "@/lib/errors/EscrowComplianceException";

/** Verified construction permit IDs follow MUD serial form, e.g. MUD-CP-2025-00042 */
const VERIFIED_PERMIT_PATTERN = /^MUD-CP-\d{4}-\d{5}$/i;

export type EscrowComplianceInput = {
  isUnfinished: boolean;
  listingType: ListingType;
  constructionStage?: ConstructionStage | null;
  escrowAccountNumber?: string | null;
  bankEscrowProvider?: string | null;
  constructionPermitId?: string | null;
  constructionPermitVerified?: boolean | null;
};

/**
 * Evaluates unfinished state: explicit flag, off-plan type, or non-complete stage.
 */
export function evaluateIsUnfinished(input: {
  isUnfinished?: boolean | null;
  listingType: ListingType;
  constructionStage?: ConstructionStage | null;
}): boolean {
  if (typeof input.isUnfinished === "boolean") {
    return input.isUnfinished;
  }

  if (input.listingType === ListingType.OFF_PLAN) {
    return true;
  }

  if (
    input.constructionStage &&
    input.constructionStage !== ConstructionStage.FULLY_COMPLETED
  ) {
    return true;
  }

  return false;
}

export function isVerifiedConstructionPermitId(permitId: string): boolean {
  return VERIFIED_PERMIT_PATTERN.test(permitId.trim());
}

/**
 * Proclamation 1357/2024 — unfinished stock must ship closed-bank escrow details
 * and a verified construction permit before the listing can be created.
 */
export function assertEscrowCompliance(input: EscrowComplianceInput): void {
  if (!input.isUnfinished) return;

  const issues: EscrowComplianceIssue[] = [];

  const account = input.escrowAccountNumber?.trim() ?? "";
  if (!account) {
    issues.push({
      path: "escrowAccountNumber",
      message:
        "Unfinished properties require a closed-bank escrowAccountNumber (Proc. 1357/2024)",
      code: "escrow_account_required",
    });
  }

  const bank = input.bankEscrowProvider?.trim() ?? "";
  if (!bank) {
    issues.push({
      path: "bankEscrowProvider",
      message:
        "Unfinished properties require bankEscrowProvider for the locked escrow account",
      code: "escrow_bank_required",
    });
  }

  const permitId = input.constructionPermitId?.trim() ?? "";
  if (!permitId) {
    issues.push({
      path: "constructionPermitId",
      message:
        "Unfinished properties require a verified constructionPermitId",
      code: "construction_permit_required",
    });
  } else if (
    !input.constructionPermitVerified ||
    !isVerifiedConstructionPermitId(permitId)
  ) {
    issues.push({
      path: "constructionPermitId",
      message:
        "constructionPermitId must be verified (expected MUD-CP-YYYY-NNNNN serial)",
      code: "construction_permit_unverified",
    });
  }

  if (issues.length > 0) {
    throw new EscrowComplianceException(
      "Escrow compliance failed for unfinished property under Proclamation 1357/2024",
      issues,
    );
  }
}
