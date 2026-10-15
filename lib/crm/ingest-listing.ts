import {
  CurrencyCode,
  ListingStatus,
  ListingType,
  NotificationStatus,
  PropertyCategory,
  UserRole,
} from "@prisma/client";
import { ensureBilingualListingCopy } from "@/lib/ai/translate-listing";
import { normalizeEthiopiaPhone } from "@/lib/auth/otp";
import { CRM_PUBLIC_SCRAPE_TAG } from "@/lib/catalog/crm-public-scrape";
import { allocateUniquePropertyId } from "@/lib/db/allocatePropertyId";
import { prisma } from "@/lib/db/prisma";
import { sanitizeListingImageUrls } from "@/lib/imports/listing-images";
import { isAddisSubCityCode } from "@/lib/properties/subCities";

export type AgtCrmListingIngestInput = Record<string, unknown>;

export type IngestAgtCrmListingResult =
  | { ok: true; listingId: string; action: "created" | "updated" }
  | { ok: false; error: string; status: 400 | 500 };

function parseListingType(raw: unknown): ListingType {
  if (raw === "RENT" || raw === "OFF_PLAN" || raw === "SALE") return raw;
  return ListingType.SALE;
}

function parseCategory(raw: unknown): PropertyCategory {
  if (
    raw === "COMMERCIAL" ||
    raw === "MIXED_USE" ||
    raw === "LAND" ||
    raw === "RESIDENTIAL"
  ) {
    return raw;
  }
  return PropertyCategory.RESIDENTIAL;
}

function parseCurrency(raw: unknown): CurrencyCode {
  return raw === "USD" ? CurrencyCode.USD : CurrencyCode.ETB;
}

/**
 * CRM scrapes often include landlines (011…) or messy office numbers.
 * Prefer mobile E.164; otherwise accept +… or coerce Ethiopian national numbers.
 */
function normalizeCrmContactPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const mobile = normalizeEthiopiaPhone(trimmed);
  if (mobile) return mobile;

  if (trimmed.startsWith("+") && trimmed.length >= 8) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (/^0\d{8,10}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^251\d{8,10}$/.test(digits)) return `+${digits}`;
  if (/^\d{8,12}$/.test(digits)) return `+${digits}`;

  // CRM register uses these when a post has no mobile (Telegram/Facebook/site).
  if (/^(telegram|website|facebook|source):.+/i.test(trimmed)) {
    return trimmed.slice(0, 120);
  }

  return null;
}

/**
 * Upsert an AGT CRM scrape/activation into EthioMLS as PENDING_REVIEW
 * with `agt-crm-activation` tags. Shared by the HTTP route and seed script.
 */
export async function ingestAgtCrmListing(
  body: AgtCrmListingIngestInput,
): Promise<IngestAgtCrmListingResult> {
  const title = String(body.title ?? "").trim() || "CRM activated listing";
  const description =
    String(body.description ?? body.scrapedRawText ?? title).trim() || title;
  const contactPhoneRaw = String(body.contactPhone ?? "").trim();
  const contactPhone = normalizeCrmContactPhone(contactPhoneRaw);

  if (!contactPhone) {
    return {
      ok: false,
      error: "contactPhone (E.164) is required",
      status: 400,
    };
  }

  const owner =
    (await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));

  if (!owner) {
    return {
      ok: false,
      error: "No admin owner account available",
      status: 500,
    };
  }

  const rawSubCity = body.subCityCode ?? body.subcityCode;
  const subCityCode =
    typeof rawSubCity === "string" && isAddisSubCityCode(rawSubCity)
      ? rawSubCity
      : null;
  const subCity = subCityCode
    ? await prisma.subCity.findUnique({
        where: { code: subCityCode },
        select: { id: true, isActive: true },
      })
    : null;

  const images = sanitizeListingImageUrls(
    Array.isArray(body.imageUrls) ? body.imageUrls : [],
  );

  const priceAmount = Math.max(1, Number(body.priceAmount) || 1);
  const listingType = parseListingType(body.listingType);
  const bilingual = await ensureBilingualListingCopy({
    title: { en: title, am: "" },
    description: { en: description.slice(0, 4000), am: "" },
  });

  const crmPropertyId =
    typeof body.crmPropertyId === "string" ? body.crmPropertyId.trim() : null;
  const sourceExternalId = crmPropertyId
    ? `agt-crm:${crmPropertyId}`
    : `agt-crm:${Date.now()}`;

  const existing = await prisma.listing.findFirst({
    where: { sourceExternalId },
    select: { id: true },
  });

  const shared = {
    ownerId: owner.id,
    subCityId: subCity?.isActive ? subCity.id : null,
    title: bilingual.title,
    description: bilingual.description,
    titleEn: bilingual.titleEn || null,
    titleAm: bilingual.titleAm || null,
    descriptionEn: bilingual.descriptionEn || null,
    descriptionAm: bilingual.descriptionAm || null,
    listingType,
    category: parseCategory(body.category),
    status: ListingStatus.PENDING_REVIEW,
    priceAmount,
    priceCurrency: parseCurrency(body.priceCurrency),
    bedrooms:
      body.bedrooms != null && Number.isFinite(Number(body.bedrooms))
        ? Number(body.bedrooms)
        : null,
    bathrooms:
      body.bathrooms != null && Number.isFinite(Number(body.bathrooms))
        ? Number(body.bathrooms)
        : null,
    floorAreaSqm:
      body.floorAreaSqm != null && Number.isFinite(Number(body.floorAreaSqm))
        ? Number(body.floorAreaSqm)
        : null,
    addressLine: typeof body.addressLine === "string" ? body.addressLine : null,
    images,
    galleryImageUrls: images,
    coverImageUrl: images[0] ?? null,
    contactPhone,
    contactName: typeof body.contactName === "string" ? body.contactName : null,
    sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
    sourceExternalId,
    scrapedRawText:
      typeof body.scrapedRawText === "string"
        ? body.scrapedRawText.slice(0, 12_000)
        : description.slice(0, 12_000),
    sourcePostedAt: body.sourcePostedAt
      ? new Date(String(body.sourcePostedAt))
      : new Date(),
    notificationStatus: NotificationStatus.NOT_APPLICABLE,
    metadataTags: [
      CRM_PUBLIC_SCRAPE_TAG,
      "import",
      ...(crmPropertyId ? [`crm-property:${crmPropertyId}`] : []),
    ],
    publishedAt: null,
  };

  if (existing) {
    await prisma.listing.update({
      where: { id: existing.id },
      data: shared,
    });
    return { ok: true, listingId: existing.id, action: "updated" };
  }

  const listingId = await allocateUniquePropertyId(prisma);
  await prisma.listing.create({
    data: { id: listingId, ...shared },
  });

  return { ok: true, listingId, action: "created" };
}
