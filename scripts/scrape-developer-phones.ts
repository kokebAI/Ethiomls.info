/**
 * Scrape developer websites for Ethiopian phones, then attach them to
 * developer users + their no-phone listings in the invite queue.
 *
 * Usage:
 *   npx tsx scripts/scrape-developer-phones.ts --dry-run
 *   npx tsx scripts/scrape-developer-phones.ts
 */
import { NotificationStatus } from "@prisma/client";
import { extractEthiopiaPhones } from "../lib/imports/extract-contacts";
import { fetchPublicText } from "../lib/imports/fetch-safe";
import { prisma } from "../lib/db/prisma";

const dryRun = process.argv.includes("--dry-run");
const delayMs = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function scrapePhoneFromWebsite(website: string): Promise<string | null> {
  const url = normalizeWebsite(website);
  if (!url) return null;
  const origins = [url];
  try {
    const base = new URL(url);
    origins.push(
      new URL("/contact", base).toString(),
      new URL("/contact-us", base).toString(),
      new URL("/about", base).toString(),
      new URL("/about-us", base).toString(),
    );
  } catch {
    // ignore
  }

  for (const candidate of origins) {
    try {
      const { html } = await fetchPublicText(candidate);
      const phones = extractEthiopiaPhones(html);
      if (phones[0]) return phones[0];
    } catch {
      // try next path
    }
    await sleep(400);
  }
  return null;
}

async function main() {
  const noPhone = await prisma.listing.findMany({
    where: {
      notificationStatus: {
        in: [NotificationStatus.PENDING_REVIEW, NotificationStatus.FAILED],
      },
      OR: [{ contactPhone: null }, { contactPhone: "" }],
      developerId: { not: null },
    },
    select: {
      id: true,
      developerId: true,
      metadataTags: true,
      developer: {
        select: {
          id: true,
          tradeName: true,
          website: true,
          userId: true,
          user: { select: { phone: true } },
        },
      },
    },
  });

  const byDeveloper = new Map<
    string,
    {
      tradeName: string;
      website: string | null;
      userId: string;
      userPhone: string | null;
      listingIds: string[];
    }
  >();

  for (const row of noPhone) {
    if (!row.developerId || !row.developer) continue;
    const existing = byDeveloper.get(row.developerId);
    if (existing) {
      existing.listingIds.push(row.id);
    } else {
      byDeveloper.set(row.developerId, {
        tradeName: row.developer.tradeName,
        website: row.developer.website,
        userId: row.developer.userId,
        userPhone: row.developer.user.phone,
        listingIds: [row.id],
      });
    }
  }

  console.log(
    `Developers to check: ${byDeveloper.size}; listings: ${noPhone.length} (dryRun=${dryRun})`,
  );

  let scrapedOk = 0;
  let scrapedMiss = 0;
  let noWebsite = 0;
  let listingsUpdated = 0;
  let usersUpdated = 0;

  for (const [developerId, info] of byDeveloper) {
    let phone = info.userPhone?.trim() || null;

    if (!phone && info.website) {
      phone = await scrapePhoneFromWebsite(info.website);
      await sleep(delayMs);
      if (phone) scrapedOk += 1;
      else scrapedMiss += 1;
      console.log(
        `  ${info.tradeName}: ${phone ? "found" : "no phone"} (${info.listingIds.length} listings)`,
      );
    } else if (!phone) {
      noWebsite += 1;
      console.log(`  ${info.tradeName}: no website`);
    }

    if (!phone) continue;

    if (!dryRun) {
      if (!info.userPhone?.trim()) {
        const taken = await prisma.user.findFirst({
          where: { phone, NOT: { id: info.userId } },
          select: { id: true },
        });
        if (!taken) {
          await prisma.user.update({
            where: { id: info.userId },
            data: { phone },
          });
          usersUpdated += 1;
        }
      }

      for (const listingId of info.listingIds) {
        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { metadataTags: true, contactName: true },
        });
        if (!listing) continue;
        await prisma.listing.update({
          where: { id: listingId },
          data: {
            contactPhone: phone,
            contactName: listing.contactName || info.tradeName,
            metadataTags: listing.metadataTags.includes("phone-backfill")
              ? listing.metadataTags
              : [...listing.metadataTags, "phone-backfill", "phone-from-website"],
          },
        });
        listingsUpdated += 1;
      }
    } else {
      listingsUpdated += info.listingIds.length;
      if (!info.userPhone?.trim()) usersUpdated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        developersChecked: byDeveloper.size,
        scrapedOk,
        scrapedMiss,
        noWebsite,
        usersUpdated,
        listingsUpdated,
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
