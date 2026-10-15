import {
  ImportSourceType,
  ListingStatus,
  ListingType,
  NotificationStatus,
  Prisma,
  ScrapeRunStatus,
  type ImportSource,
} from "@prisma/client";
import { ensureBilingualListingCopy } from "@/lib/ai/translate-listing";
import { prisma } from "@/lib/db/prisma";
import {
  contentFingerprint,
  extractEthiopiaPhones,
} from "@/lib/imports/extract-contacts";
import { filterCorridorOffPlanCandidates } from "@/lib/imports/corridor-offplan-filter";
import { scrapeFacebookPage } from "@/lib/imports/facebook-scraper";
import { parseListingText } from "@/lib/imports/parse-listing-text";
import {
  parseIsoOrUnixDate,
  parsePostedAtFromHtml,
  parsePostedAtFromText,
} from "@/lib/imports/parse-source-date";
import { fetchPublicText } from "@/lib/imports/fetch-safe";
import {
  buildScrapeInviteMessage,
  sendScrapeInvite,
} from "@/lib/imports/scrape-invite";
import { scrapeTelegramChannel } from "@/lib/imports/telegram-scraper";
import type { ScrapedCandidate } from "@/lib/imports/telegram-scraper";
import { scrapeWebsite } from "@/lib/imports/website-scraper";
import {
  buildAgtCrmEthiomlsListingPayload,
  isAgtCrmListingRegisterConfigured,
  looksLikeHoaOnly,
  registerAgtCrmEthiomlsListing,
  scrapeDestinationIsCrm,
} from "@/lib/crm/register-ethiomls-listing";
import { generatePropertyId } from "@/src/utils/generateId";

const TELEGRAM_POST_RE =
  /^https?:\/\/(?:t\.me|telegram\.me)\/([^/]+)\/(\d+)/i;

async function resolveMandatorySourcePostedAt(input: {
  sourcePostedAt?: string | Date | null;
  sourceUrl?: string | null;
  text: string;
}): Promise<Date> {
  const fromInput =
    input.sourcePostedAt instanceof Date
      ? input.sourcePostedAt
      : parseIsoOrUnixDate(input.sourcePostedAt ?? null);
  if (fromInput) return fromInput;

  const fromText = parsePostedAtFromText(input.text);
  if (fromText) return fromText;

  const url = input.sourceUrl?.trim() ?? "";
  const tg = url.match(TELEGRAM_POST_RE);
  if (tg) {
    const [, channel, postId] = tg;
    const { html } = await fetchPublicText(
      `https://t.me/${channel}/${postId}?embed=1`,
    );
    const fromHtml = parsePostedAtFromHtml(html);
    if (fromHtml) return fromHtml;
  }

  throw new Error(
    "Post date (sourcePostedAt) is required for all scrapes. Provide sourcePostedAt, a dated source URL, or include a post date in the text.",
  );
}

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
  if (source.sourceType === ImportSourceType.WEBSITE) {
    try {
      return `website:${new URL(source.normalizedUrl).hostname}`;
    } catch {
      return `website:${source.id}`;
    }
  }
  if (source.sourceType === ImportSourceType.FACEBOOK) {
    return `facebook:${source.normalizedUrl}`;
  }
  return null;
}

/**
 * Default destination: AGT CRM Review (not live mls.et).
 * Local EthioMLS listing upsert remains only when SCRAPE_DESTINATION=local.
 */
async function upsertCandidate(input: {
  source: ImportSource;
  runId: string;
  ownerId: string;
  candidate: ScrapedCandidate;
}): Promise<{ result: "created" | "updated" | "skipped"; listingId?: string }> {
  const { source, runId, ownerId, candidate } = input;
  // Post age is mandatory for all scrapes.
  if (
    !(candidate.postedAt instanceof Date) ||
    Number.isNaN(candidate.postedAt.getTime())
  ) {
    return { result: "skipped" };
  }
  if (looksLikeHoaOnly(candidate.text)) {
    return { result: "skipped" };
  }

  if (scrapeDestinationIsCrm()) {
    const payload = buildAgtCrmEthiomlsListingPayload({ source, candidate });
    const crm = await registerAgtCrmEthiomlsListing(payload);
    if (crm.ok && crm.skipped) {
      return { result: "skipped" };
    }
    if (!crm.ok) {
      console.error(
        `[scrape→crm] ${candidate.externalId}: ${crm.error}`,
      );
      return { result: "skipped" };
    }
    const action = (crm.action ?? "").toLowerCase();
    if (action.includes("update") || action === "updated") {
      return { result: "updated", listingId: crm.crmPropertyId };
    }
    return { result: "created", listingId: crm.crmPropertyId };
  }

  // Legacy local path (SCRAPE_DESTINATION=local|ethiomls) — EthioMLS PENDING_REVIEW.
  const contactPhone = defaultContactFallback(source, candidate);
  if (!contactPhone) return { result: "skipped" };

  const existing = await prisma.listing.findFirst({
    where: {
      importSourceId: source.id,
      sourceExternalId: candidate.externalId,
    },
    select: { id: true, notificationStatus: true },
  });

  const subCityId = await resolveSubCityId(candidate.parsed.subCityCode);
  const images = candidate.imageUrls;
  const priceAmount =
    candidate.parsed.priceAmount > 0 ? candidate.parsed.priceAmount : 1;

  const bilingual = await ensureBilingualListingCopy({
    title: { en: candidate.parsed.title, am: "" },
    description: { en: candidate.parsed.description, am: "" },
  });

  const data = {
    ownerId,
    subCityId,
    title: bilingual.title,
    description: bilingual.description,
    titleEn: bilingual.titleEn || null,
    titleAm: bilingual.titleAm || null,
    descriptionEn: bilingual.descriptionEn || null,
    descriptionAm: bilingual.descriptionAm || null,
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
    scrapedRawText: candidate.text.slice(0, 12_000),
    sourcePostedAt: candidate.postedAt,
    notificationStatus:
      existing?.notificationStatus === NotificationStatus.SENT
        ? NotificationStatus.SENT
        : NotificationStatus.PENDING_REVIEW,
    notificationError: null,
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
    return { result: "updated", listingId: existing.id };
  }

  const listingId = await allocateListingId();
  await prisma.listing.create({
    data: {
      id: listingId,
      ...data,
    },
  });
  return { result: "created", listingId };
}

function inferManualImportSourceType(sourceUrl: string): ImportSourceType {
  if (/t\.me|telegram\.me/i.test(sourceUrl)) return ImportSourceType.TELEGRAM;
  if (/facebook\.com|fb\.com/i.test(sourceUrl)) return ImportSourceType.FACEBOOK;
  return ImportSourceType.WEBSITE;
}

/**
 * Ingest a single free-text scrape payload (Telegram / Facebook paste).
 * Default: push to AGT CRM Review. Local EthioMLS PENDING_REVIEW only when
 * SCRAPE_DESTINATION=local.
 */
export async function ingestScrapedText(input: {
  text: string;
  ownerId: string;
  sourceUrl?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  importSourceId?: string | null;
  sourcePostedAt?: string | Date | null;
  autoSend?: boolean;
}): Promise<{
  listingId: string;
  created: boolean;
  notificationStatus: NotificationStatus;
  inviteError?: string;
  messagePreview: string;
  destination?: "agt-crm-review" | "ethiomls-local";
}> {
  const text = input.text.trim();
  if (text.length < 20) {
    throw new Error("Scraped text is too short to ingest");
  }
  if (looksLikeHoaOnly(text)) {
    throw new Error(
      "HOA / building-admin posts are skipped on the EthioMLS listing path",
    );
  }

  const sourcePostedAt = await resolveMandatorySourcePostedAt({
    sourcePostedAt: input.sourcePostedAt,
    sourceUrl: input.sourceUrl,
    text,
  });

  const parsed = parseListingText(text);
  const fingerprint = contentFingerprint(text);
  const externalId = `manual:${fingerprint}`;
  const sourceUrl =
    input.sourceUrl?.trim() || `manual://scrape-ingest/${fingerprint}`;

  const contactPhones = [
    ...(input.contactPhone ? [input.contactPhone] : []),
    ...extractEthiopiaPhones(text),
  ];

  let importSource: ImportSource | null = null;
  if (input.importSourceId) {
    importSource = await prisma.importSource.findUnique({
      where: { id: input.importSourceId },
    });
    if (!importSource) throw new Error("Import source not found");
  }

  const toCrm = scrapeDestinationIsCrm();
  if (toCrm) {
    if (!isAgtCrmListingRegisterConfigured()) {
      throw new Error(
        "Scrapes target AGT CRM Review but CRM is not configured. Set AGT_CRM_BASE_URL and CRM_APP_API_KEY.",
      );
    }
    const sourceForCrm: ImportSource =
      importSource ??
      ({
        id: "manual-ingest",
        label: input.contactName?.trim() || "Manual scrape",
        sourceType: inferManualImportSourceType(sourceUrl),
        url: sourceUrl,
        normalizedUrl: sourceUrl,
        telegramHandle: sourceUrl.match(/t\.me\/([^/?]+)/i)?.[1] ?? null,
        notes: "manual-ingest",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRunAt: null,
        lastSuccessAt: null,
        createdById: input.ownerId,
      } as ImportSource);

    const candidate: ScrapedCandidate = {
      externalId,
      sourceUrl,
      text,
      imageUrls: [],
      contactPhones,
      parsed,
      postedAt: sourcePostedAt,
    };
    const payload = buildAgtCrmEthiomlsListingPayload({
      source: sourceForCrm,
      candidate,
    });
    const crm = await registerAgtCrmEthiomlsListing(payload);
    if (!crm.ok) {
      throw new Error(crm.error);
    }
    if (crm.skipped) {
      throw new Error("AGT CRM is not configured");
    }
    const created =
      !(crm.action ?? "").toLowerCase().includes("update") &&
      (crm.action ?? "").toLowerCase() !== "updated";
    return {
      listingId: crm.crmPropertyId ?? externalId,
      created,
      notificationStatus: NotificationStatus.NOT_APPLICABLE,
      messagePreview: payload.title,
      destination: "agt-crm-review",
    };
  }

  const contactPhone = contactPhones[0] ?? null;
  if (!contactPhone) {
    throw new Error("A contact phone is required to ingest this scrape");
  }

  const bilingual = await ensureBilingualListingCopy({
    title: { en: parsed.title, am: "" },
    description: { en: parsed.description, am: "" },
  });
  const subCityId = await resolveSubCityId(parsed.subCityCode);
  const priceAmount = parsed.priceAmount > 0 ? parsed.priceAmount : 1;

  const existing = importSource
    ? await prisma.listing.findFirst({
        where: {
          importSourceId: importSource.id,
          sourceExternalId: externalId,
        },
        select: { id: true },
      })
    : await prisma.listing.findFirst({
        where: { sourceExternalId: externalId },
        select: { id: true },
      });

  const sharedData = {
    ownerId: input.ownerId,
    subCityId,
    title: bilingual.title,
    description: bilingual.description,
    titleEn: bilingual.titleEn || null,
    titleAm: bilingual.titleAm || null,
    descriptionEn: bilingual.descriptionEn || null,
    descriptionAm: bilingual.descriptionAm || null,
    listingType: parsed.listingType,
    category: parsed.category,
    status: ListingStatus.PENDING_REVIEW,
    publishedAt: null,
    priceAmount,
    priceCurrency: parsed.priceCurrency,
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms,
    floorAreaSqm: parsed.floorAreaSqm,
    addressLine: parsed.addressLine,
    contactPhone,
    contactName:
      input.contactName?.trim() || importSource?.label || null,
    sourceUrl,
    sourceExternalId: externalId,
    importSourceId: importSource?.id ?? null,
    scrapedRawText: text.slice(0, 12_000),
    sourcePostedAt,
    notificationStatus: NotificationStatus.PENDING_REVIEW,
    notificationError: null,
    metadataTags: [
      "import",
      importSource
        ? `source:${importSource.sourceType.toLowerCase()}`
        : "source:manual-ingest",
      ...(parsed.areaTag ? [`area:${parsed.areaTag}`] : []),
      ...contactPhones.map((phone) => `phone:${phone}`),
    ],
    adminAuditApprovedAt: null,
    adminAuditedById: null,
    adminAuditNotes: null,
    adminAuditChecklist: Prisma.DbNull,
  };

  let listingId: string;
  let created: boolean;
  if (existing) {
    await prisma.listing.update({
      where: { id: existing.id },
      data: sharedData,
    });
    listingId = existing.id;
    created = false;
  } else {
    listingId = await allocateListingId();
    await prisma.listing.create({
      data: { id: listingId, ...sharedData },
    });
    created = true;
  }

  if (input.autoSend) {
    const invite = await sendScrapeInvite(listingId);
    return {
      listingId,
      created,
      notificationStatus: invite.listing.notificationStatus,
      inviteError: invite.error,
      messagePreview: invite.messagePreview,
      destination: "ethiomls-local",
    };
  }

  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
  });
  return {
    listingId,
    created,
    notificationStatus: NotificationStatus.PENDING_REVIEW,
    messagePreview: buildScrapeInviteMessage(listing),
    destination: "ethiomls-local",
  };
}

/** Mark scrape runs left RUNNING after serverless timeouts as FAILED. */
export async function failStaleRunningScrapeRuns(options?: {
  importSourceId?: string;
  /** Default 90s — slightly above admin route maxDuration. */
  olderThanMs?: number;
}): Promise<number> {
  const olderThanMs = options?.olderThanMs ?? 90_000;
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.scrapeRun.updateMany({
    where: {
      status: ScrapeRunStatus.RUNNING,
      startedAt: { lt: cutoff },
      ...(options?.importSourceId
        ? { importSourceId: options.importSourceId }
        : {}),
    },
    data: {
      status: ScrapeRunStatus.FAILED,
      finishedAt: new Date(),
      errorMessage:
        "Scrape timed out or was interrupted before finishing. Try again — Facebook/website pages can be large.",
    },
  });
  return result.count;
}

export async function runImportSource(input: {
  sourceId: string;
  adminUserId: string;
  filters?: RunImportFilters;
  /** When true, HaHu invite SMS fires immediately after each upsert. */
  autoSend?: boolean;
}) {
  const source = await prisma.importSource.findUnique({
    where: { id: input.sourceId },
  });
  if (!source) throw new Error("Import source not found");
  if (!source.isActive) throw new Error("Import source is inactive");

  const toCrm = scrapeDestinationIsCrm();
  if (toCrm && !isAgtCrmListingRegisterConfigured()) {
    throw new Error(
      "Scrapes target AGT CRM Review but CRM is not configured. Set AGT_CRM_BASE_URL and CRM_APP_API_KEY (or AGT_CRM_API_KEY). Set SCRAPE_DESTINATION=local only for legacy EthioMLS PENDING_REVIEW upserts.",
    );
  }

  // Recover runs killed by platform timeouts (left RUNNING forever).
  await failStaleRunningScrapeRuns({ importSourceId: source.id });

  // Invites apply only to local EthioMLS listings — never for CRM Review pushes.
  const autoSend = Boolean(input.autoSend) && !toCrm;
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

    if (candidates.length === 0) {
      throw new Error(
        `No listings found from ${source.normalizedUrl}. For Telegram, the channel must be public (t.me/s/…). For websites, listing HTML or a JSON/CMS feed is required.`,
      );
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
    let invitesSent = 0;
    let invitesFailed = 0;
    const upsertedIds: string[] = [];

    if (corridorFilter || input.filters?.saleOrRentOnly) {
      skipped += postsSeen - candidates.length;
    }

    for (const candidate of candidates) {
      const { result, listingId } = await upsertCandidate({
        source,
        runId: run.id,
        ownerId: input.adminUserId,
        candidate,
      });
      if (result === "created") created += 1;
      else if (result === "updated") updated += 1;
      else skipped += 1;
      if (listingId) upsertedIds.push(listingId);
    }

    if (autoSend) {
      for (const listingId of upsertedIds) {
        const invite = await sendScrapeInvite(listingId);
        if (invite.ok) invitesSent += 1;
        else invitesFailed += 1;
      }
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
          destination: toCrm ? "agt-crm-review" : "ethiomls-local",
          corridorOffPlanOnly: Boolean(corridorFilter),
          eastOffPlanOnly: Boolean(input.filters?.eastOffPlanOnly),
          saleOrRentOnly: Boolean(input.filters?.saleOrRentOnly),
          matchedAfterFilter: candidates.length,
          sampleTitles: candidates.slice(0, 5).map((c) => c.parsed.title),
          autoSend,
          invitesSent,
          invitesFailed,
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
