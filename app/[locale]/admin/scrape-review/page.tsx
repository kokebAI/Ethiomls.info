import type { Metadata } from "next";
import { ListingStatus, NotificationStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { ScrapeReviewQueue } from "@/components/admin/ScrapeReviewQueue";
import { PageIntro } from "@/components/PageIntro";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import {
  buildScrapeInviteMessage,
} from "@/lib/imports/scrape-invite-message";
import {
  type ScrapeReviewItem,
} from "@/lib/imports/scrape-review-groups";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;
  const dictionary = getDictionary(locale);
  return { title: dictionary.scrapeReview.title };
}

export default async function AdminScrapeReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "am") as Locale;
  const dictionary = getDictionary(locale);
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(`/${locale}/login`);
  }

  // Real scrapes / imports only — exclude seed inventory & project units
  // that landed in the invite queue without source text or an import source.
  const pending = await prisma.listing.findMany({
    where: {
      status: ListingStatus.PENDING_REVIEW,
      AND: [
        {
          OR: [
            {
              notificationStatus: {
                in: [
                  NotificationStatus.PENDING_REVIEW,
                  NotificationStatus.FAILED,
                ],
              },
            },
            {
              notificationStatus: NotificationStatus.NOT_APPLICABLE,
              OR: [
                { importSourceId: { not: null } },
                { scrapedRawText: { not: null } },
                { metadataTags: { has: "import" } },
                { metadataTags: { has: "sales-kit-import" } },
              ],
            },
          ],
        },
        {
          OR: [
            { scrapedRawText: { not: null } },
            { importSourceId: { not: null } },
            { sourceUrl: { not: null } },
            { metadataTags: { has: "import" } },
            { metadataTags: { has: "sales-kit-import" } },
          ],
        },
      ],
    },
    orderBy: [{ sourcePostedAt: "asc" }, { createdAt: "asc" }],
    take: 500,
    include: {
      importSource: { select: { id: true, label: true } },
    },
  });

  const items: ScrapeReviewItem[] = pending.map((listing) => {
    const sourceFromTag =
      listing.metadataTags
        .find((tag) => tag.startsWith("source:"))
        ?.replace(/^source:/, "")
        .trim() || null;
    const sourcePostedAt = listing.sourcePostedAt?.toISOString() ?? null;
    const postedAt = sourcePostedAt ?? listing.createdAt.toISOString();

    return {
      id: listing.id,
      scrapedRawText: listing.scrapedRawText,
      titleEn: listing.titleEn,
      titleAm: listing.titleAm,
      descriptionEn: listing.descriptionEn,
      descriptionAm: listing.descriptionAm,
      contactPhone: listing.contactPhone,
      contactName: listing.contactName,
      priceAmount: listing.priceAmount.toString(),
      priceCurrency: listing.priceCurrency,
      listingType: listing.listingType,
      bedrooms: listing.bedrooms,
      addressLine: listing.addressLine,
      sourceUrl: listing.sourceUrl,
      messagePreview: buildScrapeInviteMessage(listing),
      importSourceLabel:
        listing.importSource?.label ?? sourceFromTag ?? null,
      importSourceId: listing.importSourceId,
      createdAt: listing.createdAt.toISOString(),
      sourcePostedAt,
      postedAt,
      postedAtIsEstimated: !sourcePostedAt,
    };
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageIntro
        eyebrow={dictionary.scrapeReview.eyebrow}
        title={dictionary.scrapeReview.title}
        lede={dictionary.scrapeReview.lede}
      />
      <ScrapeReviewQueue initialItems={items} />
    </div>
  );
}
