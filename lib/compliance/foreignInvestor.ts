import { ListingType, type CurrencyCode } from "@prisma/client";
import {
  getNbeUsdEtbDayRate,
  toUsdEquivalent,
  type NbeDayRate,
} from "@/lib/compliance/nbeRate";

/** Statutory minimum investment / sale threshold under Proclamation 1388/2025. */
export const FOREIGNER_ELIGIBILITY_USD_FLOOR = 150_000;

export type ForeignEligibilityInput = {
  listingType: ListingType;
  price: number;
  currency: CurrencyCode;
};

export type ForeignEligibilityResult = {
  foreignerEligible: boolean;
  priceUsdEquivalent: number;
  nbeRate: NbeDayRate;
  proclamation: "1388/2025";
  clearanceBadgeActive: boolean;
  reason: string;
};

/**
 * Automated legal evaluation for Proc. 1388/2025 foreign-buyer clearance.
 * Sale listings at/above USD 150,000 (via NBE day-rate proxy) activate the badge.
 */
export function evaluateForeignerEligibility(
  input: ForeignEligibilityInput,
): ForeignEligibilityResult {
  const nbeRate = getNbeUsdEtbDayRate();
  const priceUsdEquivalent = toUsdEquivalent(
    input.price,
    input.currency,
    nbeRate,
  );

  const isSale = input.listingType === ListingType.SALE;
  const meetsFloor = priceUsdEquivalent >= FOREIGNER_ELIGIBILITY_USD_FLOOR;
  const foreignerEligible = isSale && meetsFloor;

  return {
    foreignerEligible,
    priceUsdEquivalent: Number(priceUsdEquivalent.toFixed(2)),
    nbeRate,
    proclamation: "1388/2025",
    clearanceBadgeActive: foreignerEligible,
    reason: !isSale
      ? "Foreigner clearance badge applies to SALE transactions only"
      : meetsFloor
        ? `Sale price USD ${priceUsdEquivalent.toFixed(2)} meets the ${FOREIGNER_ELIGIBILITY_USD_FLOOR} USD Proc. 1388/2025 floor`
        : `Sale price USD ${priceUsdEquivalent.toFixed(2)} is below the ${FOREIGNER_ELIGIBILITY_USD_FLOOR} USD Proc. 1388/2025 floor`,
  };
}
