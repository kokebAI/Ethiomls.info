import {
  CurrencyCode,
  ListingStatus,
  ListingType,
  NotificationStatus,
  PropertyCategory,
  UserRole,
} from "@prisma/client";
import { allocateUniquePropertyId } from "@/lib/db/allocatePropertyId";
import { prisma } from "@/lib/db/prisma";
import type { SalesKitListingDraft } from "@/lib/imports/sales-kit-parse";
import type { RoleAccountSummary } from "@/lib/imports/resolve-role-account";

function parseListingType(raw: string): ListingType {
  if (raw === "SALE" || raw === "RENT" || raw === "OFF_PLAN") return raw;
  return ListingType.OFF_PLAN;
}

function parseCategory(raw: string): PropertyCategory {
  if (
    raw === "RESIDENTIAL" ||
    raw === "COMMERCIAL" ||
    raw === "MIXED_USE" ||
    raw === "LAND"
  ) {
    return raw;
  }
  return PropertyCategory.COMMERCIAL;
}

function parseCurrency(raw: string): CurrencyCode {
  return raw === "USD" ? CurrencyCode.USD : CurrencyCode.ETB;
}

export async function importSalesKitListings(input: {
  account: RoleAccountSummary;
  listings: SalesKitListingDraft[];
  sourceLabel: string;
}): Promise<{ created: number; listingIds: string[] }> {
  const subCities = await prisma.subCity.findMany({
    where: { isActive: true },
    select: { id: true, code: true },
  });
  const subCityByCode = new Map(subCities.map((s) => [s.code, s.id]));

  const developerId =
    input.account.role === UserRole.CORPORATE_DEVELOPER
      ? (
          await prisma.developerProfile.findUnique({
            where: { userId: input.account.userId },
            select: { id: true },
          })
        )?.id ?? null
      : null;

  const delalaId =
    input.account.role === UserRole.INDEPENDENT_DELALA
      ? (
          await prisma.delalaProfile.findUnique({
            where: { userId: input.account.userId },
            select: { id: true },
          })
        )?.id ?? null
      : null;

  const listingIds: string[] = [];
  let created = 0;

  for (const [index, draft] of input.listings.entries()) {
    const subCityId = subCityByCode.get(draft.subCity) ?? null;
    const listingType = parseListingType(draft.listingType);
    const id = await allocateUniquePropertyId(prisma);
    const unitKey = draft.unitLabel?.trim() || `row-${index + 1}`;
    const priceAmount = draft.price > 0 ? draft.price : 1;

    const rawParts = [
      draft.projectName ? `Project: ${draft.projectName}` : null,
      draft.unitLabel ? `Unit: ${draft.unitLabel}` : null,
      draft.title,
      draft.description,
      draft.addressLine || null,
    ].filter(Boolean);

    await prisma.listing.create({
      data: {
        id,
        ownerId: input.account.userId,
        developerId,
        delalaId,
        subCityId,
        title: { en: draft.title, am: draft.title },
        description: {
          en: draft.description,
          am: draft.description,
        },
        titleEn: draft.title || null,
        titleAm: draft.title || null,
        descriptionEn: draft.description || null,
        descriptionAm: draft.description || null,
        listingType,
        category: parseCategory(draft.category),
        status: ListingStatus.PENDING_REVIEW,
        priceAmount,
        priceCurrency: parseCurrency(draft.currency),
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        floorAreaSqm: draft.sizeM2 > 0 ? draft.sizeM2 : null,
        addressLine: draft.addressLine || null,
        isUnfinished: listingType === ListingType.OFF_PLAN,
        contactPhone: input.account.phone,
        contactName: input.account.label,
        scrapedRawText: rawParts.join("\n").slice(0, 12_000),
        notificationStatus: NotificationStatus.PENDING_REVIEW,
        notificationError: null,
        metadataTags: [
          "sales-kit-import",
          "import",
          `source:${input.sourceLabel.slice(0, 80)}`,
          `unit:${unitKey}`,
          ...(draft.floor != null ? [`floor:${draft.floor}`] : []),
          ...(draft.projectName
            ? [`project:${draft.projectName.slice(0, 60)}`]
            : []),
          `role:${input.account.role.toLowerCase()}`,
        ],
        publishedAt: null,
      },
    });
    listingIds.push(id);
    created += 1;
  }

  return { created, listingIds };
}
