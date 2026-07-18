import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingStatus, UserRole } from "@prisma/client";
import { DeveloperWorkspaceView } from "@/components/developers/DeveloperWorkspaceView";
import type { DirectoryItem } from "@/components/PageDirectory";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/getDictionary";

export const dynamic = "force-dynamic";

function listingTitle(listing: {
  titleEn: string | null;
  title: unknown;
}): string {
  if (listing.titleEn?.trim()) return listing.titleEn.trim();
  if (
    listing.title &&
    typeof listing.title === "object" &&
    listing.title !== null &&
    "en" in listing.title
  ) {
    const en = (listing.title as { en?: string }).en;
    if (en?.trim()) return en.trim();
  }
  return "Listing";
}

function toDirectoryItem(
  locale: string,
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
): DirectoryItem {
  const subCityName =
    listing.subCity?.name &&
    typeof listing.subCity.name === "object" &&
    listing.subCity.name !== null &&
    "en" in listing.subCity.name
      ? String((listing.subCity.name as { en?: string }).en ?? "")
      : "";

  return {
    id: listing.id,
    title: listingTitle(listing),
    meta: [listing.id, listing.listingType.replaceAll("_", " "), subCityName]
      .filter(Boolean)
      .join(" · "),
    href: `/${locale}/listings/${listing.id}`,
    imageUrl: listing.coverImageUrl || listing.galleryImageUrls[0] || null,
    photoCount: listing.galleryImageUrls.length,
    badges: [
      {
        label: listing.status.replaceAll("_", " "),
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
    select: {
      id: true,
      role: true,
      faydaIdentity: { select: { id: true } },
      developerProfile: {
        select: { id: true, tradeName: true },
      },
    },
  });

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (user.role !== UserRole.CORPORATE_DEVELOPER && user.role !== UserRole.ADMIN) {
    redirect(`/${locale}/roles/developer`);
  }

  const [pending, published] = await Promise.all([
    prisma.listing.findMany({
      where: {
        ownerId: user.id,
        status: ListingStatus.PENDING_REVIEW,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
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
      take: 12,
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
  ]);

  const dictionary = getDictionary(locale);
  const ws = dictionary.workspace?.developer;
  if (!ws) {
    redirect(`/${locale}/roles/developer`);
  }

  return (
    <main>
      <DeveloperWorkspaceView
        locale={locale}
        tradeName={user.developerProfile?.tradeName ?? null}
        developerId={user.developerProfile?.id ?? null}
        hasFayda={Boolean(user.faydaIdentity)}
        pendingItems={pending.map((listing) =>
          toDirectoryItem(locale, listing),
        )}
        publishedItems={published.map((listing) =>
          toDirectoryItem(locale, listing),
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
