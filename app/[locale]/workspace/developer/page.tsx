import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingStatus, UserRole } from "@prisma/client";
import { DeveloperWorkspaceView } from "@/components/developers/DeveloperWorkspaceView";
import type { DirectoryItem } from "@/components/PageDirectory";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  labelEnum,
  localizedListingTitle,
  localizedSubCityName,
} from "@/lib/i18n/enums";
import { getDictionary } from "@/lib/i18n/getDictionary";

export const dynamic = "force-dynamic";

function toDirectoryItem(
  locale: Locale,
  listing: {
    id: string;
    titleEn: string | null;
    title: unknown;
    status: ListingStatus;
    listingType: string;
    coverImageUrl: string | null;
    galleryImageUrls: string[];
    subCity: { name: unknown } | null;
  },
  enums: {
    listingStatus: Record<string, string>;
    listingType: Record<string, string>;
    listingFallback: string;
  },
): DirectoryItem {
  const subCityName = localizedSubCityName(listing.subCity, locale);

  return {
    id: listing.id,
    title: localizedListingTitle(listing, locale, enums.listingFallback),
    meta: [
      listing.id,
      labelEnum(enums.listingType, listing.listingType),
      subCityName,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/${locale}/listings/${listing.id}`,
    imageUrl: listing.coverImageUrl || listing.galleryImageUrls[0] || null,
    photoCount: listing.galleryImageUrls.length,
    badges: [
      {
        label: labelEnum(enums.listingStatus, listing.status),
        tone:
          listing.status === ListingStatus.PUBLISHED
            ? "emerald"
            : listing.status === ListingStatus.PENDING_REVIEW
              ? "amber"
              : "slate",
      },
    ],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const copy = dictionary.workspace?.developer;
  return {
    title: copy?.title ?? "Developer workspace",
    description: copy?.lede,
  };
}

export default async function DeveloperWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: { id: true, role: true },
  });

  if (!user || user.role !== UserRole.CORPORATE_DEVELOPER) {
    redirect(`/${locale}/roles/developer`);
  }

  const dictionary = getDictionary(locale);
  const ws = dictionary.workspace?.developer;
  if (!ws) {
    redirect(`/${locale}/roles/developer`);
  }

  const enums = {
    listingStatus: dictionary.enums?.listingStatus ?? {},
    listingType: dictionary.enums?.listingType ?? {},
    listingFallback:
      dictionary.workspace?.admin?.listingFallback ?? "Listing",
  };

  const profile = await prisma.developerProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      tradeName: true,
      isVerified: true,
    },
  });

  const [pending, published, faydaOk] = await Promise.all([
    prisma.listing.findMany({
      where: {
        ownerId: user.id,
        status: {
          in: [ListingStatus.DRAFT, ListingStatus.PENDING_REVIEW],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: {
        id: true,
        titleEn: true,
        title: true,
        status: true,
        listingType: true,
        coverImageUrl: true,
        galleryImageUrls: true,
        subCity: { select: { name: true } },
      },
    }),
    prisma.listing.findMany({
      where: {
        ownerId: user.id,
        status: ListingStatus.PUBLISHED,
      },
      orderBy: { publishedAt: "desc" },
      take: 24,
      select: {
        id: true,
        titleEn: true,
        title: true,
        status: true,
        listingType: true,
        coverImageUrl: true,
        galleryImageUrls: true,
        subCity: { select: { name: true } },
      },
    }),
    prisma.user.findFirst({
      where: { id: user.id, faydaIdentity: { isNot: null } },
      select: { id: true },
    }),
  ]);

  return (
    <main>
      <DeveloperWorkspaceView
        locale={locale}
        tradeName={profile?.tradeName ?? null}
        developerId={profile?.id ?? null}
        hasFayda={Boolean(faydaOk)}
        pendingItems={pending.map((listing) =>
          toDirectoryItem(locale, listing, enums),
        )}
        publishedItems={published.map((listing) =>
          toDirectoryItem(locale, listing, enums),
        )}
        copy={{
          eyebrow: ws.eyebrow,
          title: ws.title,
          lede: ws.lede,
          motto: dictionary.brand.motto,
          addInventory: ws.addInventory,
          viewProjects: ws.viewProjects,
          myPage: ws.myPage,
          accountProfile: ws.accountProfile,
          readinessTitle: ws.readinessTitle,
          readinessProfileOk: ws.readinessProfileOk,
          readinessProfileNeeded: ws.readinessProfileNeeded,
          readinessFaydaOk: ws.readinessFaydaOk,
          readinessFaydaNeeded: ws.readinessFaydaNeeded,
          readinessPending: ws.readinessPending,
          packTitle: ws.packTitle,
          packLede: ws.packLede,
          packPhotos: ws.packPhotos,
          packFayda: ws.packFayda,
          packCta: ws.packCta,
          pendingTitle: ws.pendingTitle,
          pendingEmpty: ws.pendingEmpty,
          publishedTitle: ws.publishedTitle,
          publishedEmpty: ws.publishedEmpty,
        }}
      />
    </main>
  );
}
