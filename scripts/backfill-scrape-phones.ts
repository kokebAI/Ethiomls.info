/**
 * Backfill contactPhone on scrape-queue listings missing a phone.
 *
 * Sources (in order):
 * 1) Linked developer / delala / owner user.phone
 * 2) Sibling listing contactPhone (same developerId or projectId)
 *
 * Optionally remove non-scrape inventory (seed / project units / doc-assist)
 * from the invite queue so only real scrapes remain.
 *
 * Usage:
 *   npx tsx scripts/backfill-scrape-phones.ts --dry-run
 *   npx tsx scripts/backfill-scrape-phones.ts --remove-non-scrapes
 */
import { NotificationStatus } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

const dryRun = process.argv.includes("--dry-run");
const removeNonScrapes = process.argv.includes("--remove-non-scrapes");

function isNonScrape(tags: string[]): boolean {
  if (tags.includes("import") || tags.includes("sales-kit-import")) return false;
  if (tags.some((t) => t.startsWith("seed:"))) return true;
  if (tags.includes("document-assisted-submission")) return true;
  if (
    tags.some((t) => t.startsWith("source:ETMLS-PRJ")) ||
    (tags.some((t) => t.startsWith("unit:")) &&
      tags.some((t) => t.startsWith("floor:")))
  ) {
    return true;
  }
  return false;
}

function addTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags : [...tags, tag];
}

async function main() {
  const queue = await prisma.listing.findMany({
    where: {
      notificationStatus: {
        in: [NotificationStatus.PENDING_REVIEW, NotificationStatus.FAILED],
      },
    },
    select: {
      id: true,
      contactPhone: true,
      contactName: true,
      metadataTags: true,
      scrapedRawText: true,
      importSourceId: true,
      sourceUrl: true,
      developerId: true,
      projectId: true,
      developer: {
        select: {
          tradeName: true,
          website: true,
          user: { select: { phone: true, fullName: true } },
        },
      },
      delala: {
        select: {
          user: { select: { phone: true, fullName: true } },
        },
      },
      owner: { select: { phone: true, fullName: true } },
      project: {
        select: {
          developer: {
            select: {
              tradeName: true,
              website: true,
              user: { select: { phone: true, fullName: true } },
            },
          },
        },
      },
    },
  });

  const noPhone = queue.filter((l) => !l.contactPhone?.trim());
  console.log(
    `Queue ${queue.length}; missing phone ${noPhone.length} (dryRun=${dryRun}, removeNonScrapes=${removeNonScrapes})`,
  );

  const developerIds = [
    ...new Set(noPhone.map((l) => l.developerId).filter(Boolean)),
  ] as string[];
  const projectIds = [
    ...new Set(noPhone.map((l) => l.projectId).filter(Boolean)),
  ] as string[];

  const siblingByDeveloper = new Map<string, string>();
  const siblingByProject = new Map<string, string>();

  if (developerIds.length) {
    const rows = await prisma.listing.findMany({
      where: {
        developerId: { in: developerIds },
        contactPhone: { not: null },
      },
      select: { developerId: true, contactPhone: true },
      orderBy: { updatedAt: "desc" },
    });
    for (const row of rows) {
      const phone = row.contactPhone?.trim();
      if (row.developerId && phone && !siblingByDeveloper.has(row.developerId)) {
        siblingByDeveloper.set(row.developerId, phone);
      }
    }
  }

  if (projectIds.length) {
    const rows = await prisma.listing.findMany({
      where: {
        projectId: { in: projectIds },
        contactPhone: { not: null },
      },
      select: { projectId: true, contactPhone: true },
      orderBy: { updatedAt: "desc" },
    });
    for (const row of rows) {
      const phone = row.contactPhone?.trim();
      if (row.projectId && phone && !siblingByProject.has(row.projectId)) {
        siblingByProject.set(row.projectId, phone);
      }
    }
  }

  let filledFromAccount = 0;
  let filledFromSibling = 0;
  let skipped = 0;
  let removed = 0;
  let websitesKnown = 0;

  for (const listing of noPhone) {
    const tags = listing.metadataTags ?? [];
    const accountPhone =
      listing.developer?.user?.phone?.trim() ||
      listing.delala?.user?.phone?.trim() ||
      listing.project?.developer?.user?.phone?.trim() ||
      listing.owner?.phone?.trim() ||
      null;
    const siblingPhone =
      (listing.developerId
        ? siblingByDeveloper.get(listing.developerId)
        : null) ||
      (listing.projectId ? siblingByProject.get(listing.projectId) : null) ||
      null;
    const phone = accountPhone || siblingPhone;
    const name =
      listing.developer?.tradeName?.trim() ||
      listing.project?.developer?.tradeName?.trim() ||
      listing.developer?.user?.fullName?.trim() ||
      listing.delala?.user?.fullName?.trim() ||
      listing.owner?.fullName?.trim() ||
      listing.contactName ||
      null;

    if (listing.developer?.website || listing.project?.developer?.website) {
      websitesKnown += 1;
    }

    if (phone) {
      if (accountPhone) filledFromAccount += 1;
      else filledFromSibling += 1;
      if (!dryRun) {
        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            contactPhone: phone,
            ...(name && !listing.contactName ? { contactName: name } : {}),
            metadataTags: addTag(tags, "phone-backfill"),
          },
        });
      }
      continue;
    }

    skipped += 1;
  }

  if (removeNonScrapes) {
    for (const listing of queue) {
      const tags = listing.metadataTags ?? [];
      if (
        isNonScrape(tags) &&
        !listing.scrapedRawText &&
        !listing.importSourceId &&
        !listing.sourceUrl
      ) {
        removed += 1;
        if (!dryRun) {
          await prisma.listing.update({
            where: { id: listing.id },
            data: {
              notificationStatus: NotificationStatus.NOT_APPLICABLE,
              notificationError: null,
            },
          });
        }
      }
    }
  }

  const remainingQueue = dryRun
    ? queue.length - removed
    : await prisma.listing.count({
        where: {
          notificationStatus: {
            in: [NotificationStatus.PENDING_REVIEW, NotificationStatus.FAILED],
          },
        },
      });
  const remainingNoPhone = dryRun
    ? Math.max(0, skipped)
    : await prisma.listing.count({
        where: {
          notificationStatus: {
            in: [NotificationStatus.PENDING_REVIEW, NotificationStatus.FAILED],
          },
          OR: [{ contactPhone: null }, { contactPhone: "" }],
        },
      });

  console.log(
    JSON.stringify(
      {
        filledFromAccount,
        filledFromSibling,
        skippedNoPhoneFound: skipped,
        removedNonScrapesFromQueue: removed,
        listingsWithDeveloperWebsiteButNoPhone: websitesKnown,
        queueAfter: remainingQueue,
        noPhoneAfter: remainingNoPhone,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
