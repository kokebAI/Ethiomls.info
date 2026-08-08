import { NextRequest, NextResponse } from "next/server";
import {
  CurrencyCode,
  ListingStatus,
  ListingType,
  NotificationStatus,
  PropertyCategory,
  UserRole,
} from "@prisma/client";
import { ensureBilingualListingCopy } from "@/lib/ai/translate-listing";
import { allocateUniquePropertyId } from "@/lib/db/allocatePropertyId";
import { prisma } from "@/lib/db/prisma";
import { sanitizeListingImageUrls } from "@/lib/imports/listing-images";
import { isAddisSubCityCode } from "@/lib/properties/subCities";
import { normalizeEthiopiaPhone } from "@/lib/auth/otp";

export const runtime = "nodejs";

function assertCrmIngestAuth(req: NextRequest): NextResponse | null {
  const expected =
    process.env.CRM_INGEST_API_KEY?.trim() ||
    process.env.AGT_CRM_API_KEY?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "CRM_INGEST_API_KEY is not configured" },
      { status: 500 },
    );
  }
  const header = req.headers.get("x-crm-api-key")?.trim();
  const auth = req.headers.get("authorization");
  const bearer =
    auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const provided = header || bearer;
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

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
 * POST /api/crm/ingest-listing
 * AGT CRM product activation → EthioMLS listing (PENDING_REVIEW).
 * Auth: x-crm-api-key or Bearer = CRM_INGEST_API_KEY (or AGT_CRM_API_KEY).
 */
export async function POST(request: NextRequest) {
  const unauthorized = assertCrmIngestAuth(request);
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim() || "CRM activated listing";
  const description =
    String(body.description ?? body.scrapedRawText ?? title).trim() || title;
  const contactPhoneRaw = String(body.contactPhone ?? "").trim();
  const contactPhone =
    normalizeEthiopiaPhone(contactPhoneRaw) ??
    (contactPhoneRaw.startsWith("+") ? contactPhoneRaw : null);

  if (!contactPhone) {
    return NextResponse.json(
      { error: "contactPhone (E.164) is required" },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: "No admin owner account available" },
      { status: 500 },
    );
  }

  const subCityCode =
    typeof body.subCityCode === "string" && isAddisSubCityCode(body.subCityCode)
      ? body.subCityCode
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
    addressLine:
      typeof body.addressLine === "string" ? body.addressLine : null,
    images,
    galleryImageUrls: images,
    coverImageUrl: images[0] ?? null,
    contactPhone,
    contactName:
      typeof body.contactName === "string" ? body.contactName : null,
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
      "agt-crm-activation",
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
    return NextResponse.json({
      ok: true,
      listingId: existing.id,
      action: "updated",
    });
  }

  const listingId = await allocateUniquePropertyId(prisma);
  await prisma.listing.create({
    data: { id: listingId, ...shared },
  });

  return NextResponse.json(
    { ok: true, listingId, action: "created" },
    { status: 201 },
  );
}
