import { ListingType } from "@prisma/client";
import type { ScrapedCandidate } from "@/lib/imports/telegram-scraper";

/**
 * Citywide off-plan filter: keep OFF_PLAN ads across all Addis corridors
 * (central / east / west / south). Corridor neighborhood aliases still enrich
 * addressLine / area tags in parseListingText.
 */
export function isCorridorOffPlanCandidate(
  candidate: ScrapedCandidate,
): boolean {
  return candidate.parsed.listingType === ListingType.OFF_PLAN;
}

export function filterCorridorOffPlanCandidates(
  candidates: ScrapedCandidate[],
): ScrapedCandidate[] {
  return candidates.filter(isCorridorOffPlanCandidate);
}

/** @deprecated Prefer isCorridorOffPlanCandidate */
export function isEastOffPlanCandidate(candidate: ScrapedCandidate): boolean {
  return isCorridorOffPlanCandidate(candidate);
}

/** @deprecated Prefer filterCorridorOffPlanCandidates */
export function filterEastOffPlanCandidates(
  candidates: ScrapedCandidate[],
): ScrapedCandidate[] {
  return filterCorridorOffPlanCandidates(candidates);
}
