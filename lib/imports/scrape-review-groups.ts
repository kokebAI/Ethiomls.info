import { normalizeEthiopiaPhone } from "@/lib/auth/otp";
import { resolveInvitePhone } from "@/lib/imports/scrape-invite";

export type ScrapeReviewItem = {
  id: string;
  scrapedRawText: string | null;
  titleEn: string | null;
  titleAm: string | null;
  descriptionEn: string | null;
  descriptionAm: string | null;
  contactPhone: string | null;
  contactName: string | null;
  priceAmount: string;
  priceCurrency: string;
  listingType: string;
  bedrooms: number | null;
  addressLine: string | null;
  sourceUrl: string | null;
  messagePreview: string;
  importSourceLabel: string | null;
  importSourceId: string | null;
  createdAt: string;
  sourcePostedAt: string | null;
  postedAt: string;
  postedAtIsEstimated: boolean;
};

export type ScrapeReviewPhoneGroup = {
  phoneKey: string;
  phone: string | null;
  listings: ScrapeReviewItem[];
  oldestPostedAt: string;
  listingIds: string[];
};

export type ScrapeReviewSourceGroup = {
  importSourceId: string | null;
  label: string;
  phoneGroups: ScrapeReviewPhoneGroup[];
  listingCount: number;
  oldestPostedAt: string;
};

function phoneKeyFor(contactPhone: string | null): {
  phoneKey: string;
  phone: string | null;
} {
  const normalized = resolveInvitePhone(contactPhone);
  if (normalized) return { phoneKey: normalized, phone: normalized };
  const fallback = contactPhone?.trim();
  if (fallback) return { phoneKey: `raw:${fallback}`, phone: fallback };
  return { phoneKey: "no-phone", phone: null };
}

function compareIsoAsc(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

export function groupScrapeReviewItems(
  items: ScrapeReviewItem[],
): ScrapeReviewSourceGroup[] {
  const sourceMap = new Map<string, ScrapeReviewSourceGroup>();

  for (const item of items) {
    const sourceKey = item.importSourceId ?? "manual";
    let sourceGroup = sourceMap.get(sourceKey);
    if (!sourceGroup) {
      sourceGroup = {
        importSourceId: item.importSourceId,
        label:
          item.importSourceLabel?.trim() ||
          item.contactName?.trim() ||
          "Manual / unknown source",
        phoneGroups: [],
        listingCount: 0,
        oldestPostedAt: item.postedAt,
      };
      sourceMap.set(sourceKey, sourceGroup);
    }

    const { phoneKey, phone } = phoneKeyFor(item.contactPhone);
    let phoneGroup = sourceGroup.phoneGroups.find((g) => g.phoneKey === phoneKey);
    if (!phoneGroup) {
      phoneGroup = {
        phoneKey,
        phone,
        listings: [],
        oldestPostedAt: item.postedAt,
        listingIds: [],
      };
      sourceGroup.phoneGroups.push(phoneGroup);
    }

    phoneGroup.listings.push(item);
    phoneGroup.listingIds.push(item.id);
    if (compareIsoAsc(item.postedAt, phoneGroup.oldestPostedAt) < 0) {
      phoneGroup.oldestPostedAt = item.postedAt;
    }

    sourceGroup.listingCount += 1;
    if (compareIsoAsc(item.postedAt, sourceGroup.oldestPostedAt) < 0) {
      sourceGroup.oldestPostedAt = item.postedAt;
    }
  }

  for (const source of sourceMap.values()) {
    source.phoneGroups.sort((a, b) =>
      compareIsoAsc(a.oldestPostedAt, b.oldestPostedAt),
    );
    for (const phoneGroup of source.phoneGroups) {
      phoneGroup.listings.sort((a, b) => compareIsoAsc(a.postedAt, b.postedAt));
    }
  }

  return [...sourceMap.values()].sort((a, b) =>
    compareIsoAsc(a.oldestPostedAt, b.oldestPostedAt),
  );
}

/** Normalize phone for grouping — exported for API validation. */
export function normalizedPhoneKey(contactPhone: string | null): string {
  return phoneKeyFor(contactPhone).phoneKey;
}

export function normalizeGroupPhone(contactPhone: string | null): string | null {
  const normalized = normalizeEthiopiaPhone(contactPhone ?? "");
  return normalized ?? contactPhone?.trim() ?? null;
}
