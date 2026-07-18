import { ListingType } from "@prisma/client";
import type { ScrapedCandidate } from "@/lib/imports/telegram-scraper";
import { detectEastNeighborhood } from "@/lib/imports/parse-listing-text";

/** Keywords that place an ad in the east Addis off-plan corridor. */
const EAST_CORRIDOR_PATTERN =
  /ayat|cmc|temer|summit|feres\s*bet|achant[eé]|lemi\s*kura|yeka/i;

/**
 * Keep only off-plan candidates that mention the east corridor
 * (Ayat, CMC, Temer, Summit, Feres Bet, Achanté, Lemi Kura, Yeka).
 */
export function isEastOffPlanCandidate(candidate: ScrapedCandidate): boolean {
  if (candidate.parsed.listingType !== ListingType.OFF_PLAN) return false;

  const haystack = [
    candidate.parsed.title,
    candidate.parsed.description,
    candidate.parsed.addressLine ?? "",
    candidate.parsed.areaTag ?? "",
  ].join(" ");

  if (detectEastNeighborhood(haystack)) return true;
  return EAST_CORRIDOR_PATTERN.test(haystack);
}

export function filterEastOffPlanCandidates(
  candidates: ScrapedCandidate[],
): ScrapedCandidate[] {
  return candidates.filter(isEastOffPlanCandidate);
}
