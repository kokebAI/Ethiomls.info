import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingStatus } from "@prisma/client";
import { AdminAuditView } from "@/components/admin/AdminAuditView";
import { PageIntro } from "@/components/PageIntro";
import type { AuditPartyCategory } from "@/lib/admin/listing-party";
import {
  auditPendingSelect,
  auditReadySelect,
  toAuditDirectoryItem,
  toAuditPendingItem,
} from "@/lib/admin/audit-queue-items";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedSubCityName } from "@/lib/i18n/enums";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const copy = dictionary.workspace?.admin;
  return {
    title: copy?.toolsQueue ?? copy?.pendingTitle ?? "Audit queue",
    description: copy?.lede,
  };
}

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/admin/audit`)}`,
    );
  }

  const dictionary = getDictionary(locale);
  const ws = dictionary.workspace?.admin;
  if (!ws) {
    redirect(`/${locale}/roles/admin`);
  }

  const partyLabels: Record<AuditPartyCategory, string> = {
    developers: ws.partyDevelopers ?? "Developers",
    brokers: ws.partyBrokers ?? "Brokers",
    owners: ws.partyOwners ?? "Owners",
    imported: ws.partyImported ?? "Imported",
  };

  const enums = {
    listingStatus: dictionary.enums.listingStatus,
    listingType: dictionary.enums.listingType,
    listingFallback: ws.listingFallback ?? "Listing",
    groupOther: ws.groupOther ?? "Other",
    auditPassed: ws.auditPassed ?? "Audit passed",
  };

  const [pending, pendingProjects, drafts, ready] = await Promise.all([
    prisma.listing.findMany({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        adminAuditApprovedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: auditPendingSelect,
    }),
    prisma.project.findMany({
      where: {
        status: { in: [ListingStatus.PENDING_REVIEW, ListingStatus.DRAFT] },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        status: true,
        coverImageUrl: true,
        galleryImageUrls: true,
        adminAuditApprovedAt: true,
        developer: { select: { tradeName: true } },
        subCity: { select: { code: true, name: true } },
      },
    }),
    prisma.listing.findMany({
      where: { status: ListingStatus.DRAFT },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: auditReadySelect,
    }),
    prisma.listing.findMany({
      where: {
        status: ListingStatus.PENDING_REVIEW,
        adminAuditApprovedAt: { not: null },
      },
      orderBy: { adminAuditApprovedAt: "desc" },
      take: 80,
      select: auditReadySelect,
    }),
  ]);

  return (
    <main>
      <PageIntro
        eyebrow={ws.eyebrow}
        title={ws.toolsQueue ?? ws.pendingTitle}
        lede={ws.toolsQueueHint ?? ws.lede}
        motto={dictionary.brand.motto}
      />
      <AdminAuditView
        locale={locale}
        pendingItems={pending.map((listing) =>
          toAuditPendingItem(locale, listing, partyLabels, enums),
        )}
        pendingProjectItems={pendingProjects.map((project) => {
          const title =
            pickLocalized(
              project.title as Parameters<typeof pickLocalized>[0],
              locale,
            ) || project.id;
          const subCity = project.subCity
            ? localizedSubCityName(project.subCity, locale)
            : null;
          const cover =
            project.coverImageUrl || project.galleryImageUrls[0] || null;
          return {
            id: project.id,
            href: `/${locale}/projects/${encodeURIComponent(project.id)}`,
            title,
            meta: [project.developer.tradeName, subCity]
              .filter(Boolean)
              .join(" · "),
            imageUrl: cover,
            badges: [
              {
                label: enums.listingStatus[project.status] ?? project.status,
                tone: project.adminAuditApprovedAt ? "emerald" : "amber",
              },
              ...(project.adminAuditApprovedAt
                ? [{ label: enums.auditPassed, tone: "emerald" as const }]
                : []),
            ],
          };
        })}
        draftItems={drafts.map((listing) =>
          toAuditDirectoryItem(locale, listing, enums),
        )}
        readyItems={ready.map((listing) =>
          toAuditDirectoryItem(locale, listing, enums, enums.auditPassed),
        )}
        copy={{
          pendingTitle: ws.pendingTitle,
          pendingEmpty: ws.pendingEmpty,
          pendingProjectsTitle: ws.pendingProjectsTitle,
          pendingProjectsEmpty: ws.pendingProjectsEmpty,
          draftsEmpty: ws.draftsEmpty ?? "No draft listings.",
          readyEmpty: ws.readyEmpty,
          partyAll: ws.partyAll ?? "All",
          partyDevelopers: partyLabels.developers,
          partyBrokers: partyLabels.brokers,
          partyOwners: partyLabels.owners,
          partyImported: partyLabels.imported,
          partyDrafts: ws.partyDrafts ?? ws.draftsTitle ?? "Drafts",
          partyVerified: ws.partyVerified ?? ws.readyTitle ?? "Verified",
          partyEmpty: ws.partyEmpty ?? "No listings in this category.",
        }}
      />
    </main>
  );
}
