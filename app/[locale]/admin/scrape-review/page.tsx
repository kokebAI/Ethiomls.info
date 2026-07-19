import type { Metadata } from "next";
import { ListingStatus, NotificationStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  ScrapeReviewQueue,
  type ScrapeReviewItem,
} from "@/components/admin/ScrapeReviewQueue";
import { PageIntro } from "@/components/PageIntro";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { buildScrapeInviteMessage } from "@/lib/imports/scrape-invite";
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

  // Invite queue: scrapes + imports awaiting SMS review (incl. failed retries).
  const pending = await prisma.listing.findMany({
    where: {
      status: ListingStatus.PENDING_REVIEW,
      OR: [
        {
          notificationStatus: {
            in: [NotificationStatus.PENDING_REVIEW, NotificationStatus.FAILED],
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
    orderBy: { createdAt: "asc" },
    take: 500,
    include: {
      importSource: { select: { label: true } },
    },
  });

  const items: ScrapeReviewItem[] = pending.map((listing) => {
    const sourceFromTag =
      listing.metadataTags
        .find((tag) => tag.startsWith("source:"))
        ?.replace(/^source:/, "")
        .trim() || null;
    return {
      id: listing.id,
      scrapedRawText: listing.scrapedRawText,
      titleEn: listing.titleEn,
      titleAm: listing.titleAm,
      descriptionEn: listing.descriptionEn,
      descriptionAm: listing.descriptionAm,
      contactPhone: listing.contactPhone,
      priceAmount: listing.priceAmount.toString(),
      priceCurrency: listing.priceCurrency,
      listingType: listing.listingType,
      bedrooms: listing.bedrooms,
      addressLine: listing.addressLine,
      sourceUrl: listing.sourceUrl,
      messagePreview: buildScrapeInviteMessage(listing),
      importSourceLabel:
        listing.importSource?.label ?? sourceFromTag ?? null,
      createdAt: listing.createdAt.toISOString(),
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
