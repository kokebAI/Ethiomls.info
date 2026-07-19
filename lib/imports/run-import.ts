import {
  ImportSourceType,
  ListingStatus,
  ListingType,
  Prisma,
  ScrapeRunStatus,
  type ImportSource,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generatePropertyId } from "@/src/utils/generateId";
import { filterCorridorOffPlanCandidates } from "@/lib/imports/corridor-offplan-filter";
import { scrapeFacebookPage } from "@/lib/imports/facebook-scraper";
import { scrapeTelegramChannel } from "@/lib/imports/telegram-scraper";
import { scrapeWebsite } from "@/lib/imports/website-scraper";
import type { ScrapedCandidate } from "@/lib/imports/telegram-scraper";

export type RunImportFilters = {
  /** Only upsert OFF_PLAN ads that match any Addis corridor (central/east/west/south). */
  corridorOffPlanOnly?: boolean;
  /** @deprecated Prefer corridorOffPlanOnly */
  eastOffPlanOnly?: boolean;
  /** Only upsert SALE and RENT (skip OFF_PLAN). */
  saleOrRentOnly?: boolean;
};

async function allocateListingId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = generatePropertyId();
    const existing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  throw new Error("Could not allocate a unique listing ID");
}

async function resolveSubCityId(code: string | null): Promise<string | null> {
  if (!code) return null;
  const subCity = await prisma.subCity.findUnique({
    where: { code },
    select: { id: true, isActive: true },
  });
  return subCity?.isActive ? subCity.id : null;
}

function defaultContactFallback(source: ImportSource, candidate: ScrapedCandidate) {
  if (candidate.contactPhones[0]) return candidate.contactPhones[0];
  if (source.telegramHandle) return `telegram:@${source.telegramHandle}`;
  return null;
}

async function upsertCandidate(input: {
  source: ImportSource;
  runId: string;
  ownerId: string;
  candidate: ScrapedCandidate;
}): Promise<"created" | "updated" | "skipped"> {
  const { source, runId, ownerId, candidate } = input;
  const contactPhone = defaultContactFallback(source, candidate);
  if (!contactPhone) return "skipped";

  const existing = await prisma.listing.findFirst({
    where: {
      importSourceId: source.id,
      sourceExternalId: candidate.externalId,
    },
    select: { id: true },
  });

  const subCityId = await resolveSubCityId(candidate.parsed.subCityCode);
  const images = candidate.imageUrls;
  const priceAmount =
    candidate.parsed.priceAmount > 0 ? candidate.parsed.priceAmount : 1;

  const data = {
    ownerId,
    subCityId,
    title: { en: candidate.parsed.title, am: candidate.parsed.title },
    description: {
      en: candidate.parsed.description,
      am: candidate.parsed.description,
    },
    listingType: candidate.parsed.listingType,
    category: candidate.parsed.category,
    status: ListingStatus.PENDING_REVIEW,
    publishedAt: null,
    priceAmount,
    priceCurrency: candidate.parsed.priceCurrency,
    bedrooms: candidate.parsed.bedrooms,
    bathrooms: candidate.parsed.bathrooms,
    floorAreaSqm: candidate.parsed.floorAreaSqm,
    addressLine: candidate.parsed.addressLine,
    images,
    galleryImageUrls: images,
    coverImageUrl: images[0] ?? null,
    contactPhone,
    contactName: source.label,
    sourceUrl: candidate.sourceUrl,
    sourceExternalId: candidate.externalId,
    importSourceId: source.id,
    scrapeRunId: runId,
    metadataTags: [
      "import",
      `source:${source.sourceType.toLowerCase()}`,
      ...(source.telegramHandle ? [`telegram:${source.telegramHandle}`] : []),
      ...(candidate.parsed.areaTag ? [`area:${candidate.parsed.areaTag}`] : []),
      ...(candidate.parsed.listingType === ListingType.OFF_PLAN
        ? ["off-plan"]
        : []),
      ...candidate.contactPhones.map((phone) => `phone:${phone}`),
    ],
    adminAuditApprovedAt: null,
    adminAuditedById: null,
    adminAuditNotes: null,
    adminAuditChecklist: Prisma.DbNull,
  };

  if (existing) {
    await prisma.listing.update({
      where: { id: existing.id },
      data,
    });
    return "updated";
  }

  await prisma.listing.create({
    data: {
      id: await allocateListingId(),
      ...data,
    },
  });
  return "created";
}

export async function runImportSource(input: {
  sourceId: string;
  adminUserId: string;
  filters?: RunImportFilters;
}) {
  const source = await prisma.importSource.findUnique({
    where: { id: input.sourceId },
  });
  if (!source) throw new Error("Import source not found");
  if (!source.isActive) throw new Error("Import source is inactive");

  const run = await prisma.scrapeRun.create({
    data: {
      importSourceId: source.id,
      startedById: input.adminUserId,
      status: ScrapeRunStatus.RUNNING,
    },
  });

  await prisma.importSource.update({
    where: { id: source.id },
    data: { lastRunAt: new Date() },
  });

  try {
    let candidates: ScrapedCandidate[];
    if (source.sourceType === ImportSourceType.TELEGRAM) {
      candidates = await scrapeTelegramChannel(
        source.normalizedUrl,
        source.telegramHandle ?? "channel",
      );
    } else if (source.sourceType === ImportSourceType.FACEBOOK) {
      candidates = await scrapeFacebookPage(source.normalizedUrl);
    } else {
      candidates = await scrapeWebsite(source.normalizedUrl);
    }

    const postsSeen = candidates.length;
    const corridorFilter =
      input.filters?.corridorOffPlanOnly || input.filters?.eastOffPlanOnly;
    if (corridorFilter) {
      candidates = filterCorridorOffPlanCandidates(candidates);
    }
    if (input.filters?.saleOrRentOnly) {
      candidates = candidates.filter(
        (candidate) =>
          candidate.parsed.listingType === ListingType.SALE ||
          candidate.parsed.listingType === ListingType.RENT,
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Candidates filtered out count as skipped.
    if (corridorFilter || input.filters?.saleOrRentOnly) {
      skipped += postsSeen - candidates.length;
    }

    for (const candidate of candidates) {
      const result = await upsertCandidate({
        source,
        runId: run.id,
        ownerId: input.adminUserId,
        candidate,
      });
      if (result === "created") created += 1;
      else if (result === "updated") updated += 1;
      else skipped += 1;
    }

    const status =
      created + updated === 0
        ? ScrapeRunStatus.PARTIAL
        : ScrapeRunStatus.SUCCEEDED;

    const finished = await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        postsSeen,
        listingsCreated: created,
        listingsUpdated: updated,
        listingsSkipped: skipped,
        summary: {
          sourceType: source.sourceType,
          url: source.normalizedUrl,
          corridorOffPlanOnly: Boolean(corridorFilter),
          eastOffPlanOnly: Boolean(input.filters?.eastOffPlanOnly),
          saleOrRentOnly: Boolean(input.filters?.saleOrRentOnly),
          matchedAfterFilter: candidates.length,
          sampleTitles: candidates.slice(0, 5).map((c) => c.parsed.title),
        },
      },
    });

    if (status === ScrapeRunStatus.SUCCEEDED) {
      await prisma.importSource.update({
        where: { id: source.id },
        data: { lastSuccessAt: new Date() },
      });
    }

    return finished;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scrape run failed";
    const failed = await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status: ScrapeRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    throw Object.assign(new Error(message), { run: failed });
  }
}
