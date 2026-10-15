/**
 * Push scraped listing candidates into AGT CRM Review (crm_properties).
 * EthioMLS scrapes → CRM Review; agents Take → CRM may later ingest to mls.et.
 * Never writes CRM Postgres from this app.
 */

import type { ImportSource, ImportSourceType, ListingType } from "@prisma/client";
import {
  agtCrmSubcityFromCode,
} from "@/lib/crm/agt-crm-client";
import { contentFingerprint } from "@/lib/imports/extract-contacts";
import { sanitizeListingImageUrls } from "@/lib/imports/listing-images";
import type { ScrapedCandidate } from "@/lib/imports/telegram-scraper";
import { normalizeEthiopiaPhone } from "@/lib/auth/otp";

export type AgtCrmEthiomlsListingPayload = {
  externalId: string;
  sourceUrl: string;
  postedAt: string;
  title: string;
  description: string;
  scrapedRawText: string;
  listingType: "SALE" | "RENT" | "OFF_PLAN";
  category: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | "LAND";
  priceAmount: number;
  priceCurrency: "ETB" | "USD";
  contactPhone: string;
  contactName?: string | null;
  subcityCode?: string | null;
  addressLine?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floorAreaSqm?: number | null;
  imageUrls: string[];
  contentFingerprint: string;
  needs_listing: true;
  needs_hoa: false;
  needs_developer_tools: boolean;
  lifecycle: "discovered";
  invite_status: "pending";
  targetApps: ["ethiomls"];
  sourceType: ImportSourceType;
  sourceLabel: string;
  sourceNormalizedUrl: string;
  telegramHandle?: string | null;
  importSourceNotes?: string | null;
};

export type RegisterAgtCrmEthiomlsListingResult =
  | {
      ok: true;
      skipped: false;
      action: string;
      crmPropertyId?: string;
    }
  | { ok: true; skipped: true; reason: "not_configured" }
  | { ok: false; skipped: false; error: string };

function crmConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = (process.env.AGT_CRM_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey =
    process.env.CRM_APP_API_KEY?.trim() ||
    process.env.AGT_CRM_API_KEY?.trim() ||
    "";
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

/** HOA / building-admin posts without a unit sale/rent/off-plan offer. */
export function looksLikeHoaOnly(text: string): boolean {
  const lower = text.toLowerCase();
  const hoaCue =
    /\bhoa\b|homeowners?\s+assoc|condo(minium)?\s+assoc|building\s+(mgmt|management|board)|property\s+management\s+office|የኮንዶ|ኮንዶሚኒየም\s+ማህበር|የቤት\s+ባለቤቶች|አስተዳደር\s+ቢሮ/.test(
      lower,
    );
  const unitOffer =
    /for\s+sale|for\s+rent|off[-\s]?plan|bedroom|bed\s*rooms?|\bbr\b|m²|sqm|ብር|etb|usd|ዋጋ|ሽያጭ|ኪራይ/.test(
      lower,
    );
  return hoaCue && !unitOffer;
}

function resolveContactPhone(
  source: ImportSource,
  candidate: ScrapedCandidate,
): string {
  for (const raw of candidate.contactPhones) {
    const mobile = normalizeEthiopiaPhone(raw);
    if (mobile) return mobile;
  }
  if (candidate.contactPhones[0]) return candidate.contactPhones[0];
  if (source.telegramHandle) return `telegram:@${source.telegramHandle}`;
  if (source.sourceType === "WEBSITE") {
    try {
      return `website:${new URL(source.normalizedUrl).hostname}`;
    } catch {
      return `website:${source.id}`;
    }
  }
  if (source.sourceType === "FACEBOOK") {
    return `facebook:${source.normalizedUrl}`;
  }
  return `source:${source.id}`;
}

/**
 * Map a scraped EthioMLS candidate + import source → CRM register payload.
 */
export function buildAgtCrmEthiomlsListingPayload(input: {
  source: ImportSource;
  candidate: ScrapedCandidate;
}): AgtCrmEthiomlsListingPayload {
  const { source, candidate } = input;
  const listingType = candidate.parsed.listingType as ListingType;
  const priceAmount =
    candidate.parsed.priceAmount > 0 ? candidate.parsed.priceAmount : 0;
  const subcityCode =
    agtCrmSubcityFromCode(candidate.parsed.subCityCode) ??
    candidate.parsed.subCityCode ??
    null;

  return {
    externalId: candidate.externalId,
    sourceUrl: candidate.sourceUrl,
    postedAt: candidate.postedAt.toISOString(),
    title: candidate.parsed.title.slice(0, 240) || "Scraped listing",
    description: candidate.parsed.description.slice(0, 4_000),
    scrapedRawText: candidate.text.slice(0, 12_000),
    listingType,
    category: candidate.parsed.category,
    priceAmount,
    priceCurrency: candidate.parsed.priceCurrency === "USD" ? "USD" : "ETB",
    contactPhone: resolveContactPhone(source, candidate),
    contactName: source.label,
    subcityCode,
    addressLine: candidate.parsed.addressLine,
    bedrooms: candidate.parsed.bedrooms,
    bathrooms: candidate.parsed.bathrooms,
    floorAreaSqm: candidate.parsed.floorAreaSqm,
    imageUrls: sanitizeListingImageUrls(candidate.imageUrls, 8),
    contentFingerprint: contentFingerprint(candidate.text),
    needs_listing: true,
    needs_hoa: false,
    needs_developer_tools: listingType === "OFF_PLAN",
    lifecycle: "discovered",
    invite_status: "pending",
    targetApps: ["ethiomls"],
    sourceType: source.sourceType,
    sourceLabel: source.label,
    sourceNormalizedUrl: source.normalizedUrl,
    telegramHandle: source.telegramHandle,
    importSourceNotes: source.notes,
  };
}

/**
 * POST candidate to AGT CRM Review via `/api/crm/register-ethiomls-listing`.
 * Soft-fails when CRM env is unset (skipped). HTTP/network errors return ok:false.
 */
export async function registerAgtCrmEthiomlsListing(
  payload: AgtCrmEthiomlsListingPayload,
): Promise<RegisterAgtCrmEthiomlsListingResult> {
  const config = crmConfig();
  if (!config) {
    return { ok: true, skipped: true, reason: "not_configured" };
  }

  try {
    const res = await fetch(
      `${config.baseUrl}/api/crm/register-ethiomls-listing`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-crm-api-key": config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      },
    );

    const body = (await res.json().catch(() => ({}))) as {
      action?: string;
      crmPropertyId?: string;
      id?: string;
      message?: string;
      error?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        skipped: false,
        error:
          body.message ||
          body.error ||
          `AGT CRM register-ethiomls-listing HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      skipped: false,
      action: body.action ?? "upserted",
      crmPropertyId: body.crmPropertyId ?? body.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AGT CRM listing register failed";
    return { ok: false, skipped: false, error: message };
  }
}

export function isAgtCrmListingRegisterConfigured(): boolean {
  return crmConfig() != null;
}

/** True when scrapes should land in CRM Review (default on when CRM is configured). */
export function scrapeDestinationIsCrm(): boolean {
  const forced = (process.env.SCRAPE_DESTINATION ?? "").trim().toLowerCase();
  if (forced === "crm") return true;
  if (forced === "local" || forced === "ethiomls") return false;
  // Default: CRM Review when AGT CRM is configured.
  return isAgtCrmListingRegisterConfigured();
}
