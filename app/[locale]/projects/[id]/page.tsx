import { notFound } from "next/navigation";
import Link from "next/link";
import { ProjectAuditPanel } from "@/components/admin/ProjectAuditPanel";
import { ProjectInventoryEditor } from "@/components/inventory/ProjectInventoryEditor";
import { PageIntro } from "@/components/PageIntro";
import { ProjectBuildingDetail } from "./project-building-detail";
import { getCurrentAdmin, getCurrentOpsStaff } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth/session";
import {
  projectToBuilding,
  projectWalkthroughMeta,
} from "@/lib/catalog/project-building";
import { resolveInventoryStatus } from "@/lib/catalog/inventory-status";
import { fetchProjectById } from "@/lib/catalog/queries";
import { formatConstructionStage } from "@/lib/domain/construction-stage";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/getDictionary";
import { pickLocalized } from "@/lib/i18n/pickLocalized";
import {
  parseFloorFromTags,
  parseUnitLabelFromTags,
} from "@/lib/properties/propertyId";

/** DB-backed page — skip SSG so Vercel builds succeed without live Postgres. */
export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = (isLocale(raw) ? raw : "en") as Locale;
  const dictionary = getDictionary(locale);
  const [admin, staff, session] = await Promise.all([
    getCurrentAdmin(),
    getCurrentOpsStaff(),
    getSession(),
  ]);

  // First fetch published; if missing and signed-in, allow unpublished for staff/owner.
  let project = await fetchProjectById(decodeURIComponent(id));
  if (!project && (staff || session)) {
    project = await fetchProjectById(decodeURIComponent(id), {
      allowUnpublished: true,
    });
  }

  if (!project) {
    notFound();
  }

  const isDeveloperOwner = Boolean(
    session && session.userId === project.developer.userId,
  );
  const canEditInventory = Boolean(admin || isDeveloperOwner);

  if (!staff && !isDeveloperOwner && project.status !== "PUBLISHED") {
    notFound();
  }

  const building = projectToBuilding(project, locale);
  const walkthrough = projectWalkthroughMeta(project);
  const title = pickLocalized(project.title, locale) || project.id;
  const lede = pickLocalized(project.description, locale);
  const developerName =
    pickLocalized(project.developer.displayName, locale) ||
    project.developer.tradeName;
  const developerHref = project.developer.id
    ? `/${locale}/developers/${encodeURIComponent(project.developer.id)}`
    : null;
  const stageLabel = formatConstructionStage(project.constructionStage);
  const website =
    (typeof walkthrough.website === "string" && walkthrough.website) ||
    project.developer.website;
  const telegram =
    typeof walkthrough.telegram === "string" ? walkthrough.telegram : null;
  const projectAmenities = Array.isArray(walkthrough.amenities)
    ? walkthrough.amenities.filter((a): a is string => typeof a === "string")
    : [];
  const auditCopy = dictionary.adminAudit;
  const inv = dictionary.pages.developers.inventory;

  const editableUnits = project.listings.map((listing) => {
    const config =
      listing.virtualWalkthroughConfig &&
      typeof listing.virtualWalkthroughConfig === "object" &&
      !Array.isArray(listing.virtualWalkthroughConfig)
        ? (listing.virtualWalkthroughConfig as Record<string, unknown>)
        : {};
    const floor =
      typeof config.floor === "number"
        ? config.floor
        : (parseFloorFromTags(listing.metadataTags) ?? 0);
    const unitLabel =
      typeof config.unitLabel === "string"
        ? config.unitLabel
        : (parseUnitLabelFromTags(listing.metadataTags) ?? listing.id);
    return {
      id: listing.id,
      label: pickLocalized(listing.title, locale) || unitLabel,
      floor,
      status: resolveInventoryStatus(listing),
      href: `/${locale}/listings/${listing.id}`,
    };
  });

  return (
    <PageIntro
      eyebrow={dictionary.brand.name}
      title={title}
      lede={lede || dictionary.pages.projects.lede}
      motto={dictionary.brand.motto}
    >
      <p className="text-sm">
        <Link
          href={`/${locale}/projects`}
          className="font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          ← {dictionary.pages.projects.title}
        </Link>
      </p>

      <p className="font-mono text-xs text-slate-500 sm:text-sm">{project.id}</p>

      {staff && project.status !== "PUBLISHED" ? (
        <ProjectAuditPanel
          projectId={project.id}
          status={project.status}
          alreadyApproved={Boolean(project.adminAuditApprovedAt)}
          allowPublish={Boolean(admin)}
          copy={{
            title: dictionary.projectAudit?.title ?? auditCopy.title,
            lede: dictionary.projectAudit?.lede ?? auditCopy.lede,
            notesLabel: auditCopy.notesLabel,
            notesPlaceholder: auditCopy.notesPlaceholder,
            approve: auditCopy.approve,
            reject: auditCopy.reject,
            publish: dictionary.projectAudit?.publish ?? "Publish project",
            publishing: auditCopy.publishing,
            saving: auditCopy.saving,
            approvedReady:
              dictionary.projectAudit?.approvedReady ??
              "Audit passed — you can publish this project.",
            statusLabel: auditCopy.statusLabel,
            rejectedToDraft:
              dictionary.projectAudit?.rejectedToDraft ??
              "Project rejected and returned to draft.",
            published:
              dictionary.projectAudit?.published ?? "Project published.",
            auditFailed: auditCopy.auditFailed,
            publishFailed: auditCopy.publishFailed,
            checkAll: auditCopy.checkAll,
            uncheckAll: auditCopy.uncheckAll,
            rejectNeedsNotes: auditCopy.rejectNeedsNotes,
            approveNeedsChecks: auditCopy.approveNeedsChecks,
            publishNeedsApprove: auditCopy.publishNeedsApprove,
            publishAdminOnly: auditCopy.publishAdminOnly,
            checks: auditCopy.checks,
          }}
        />
      ) : null}

      <ProjectBuildingDetail
        building={building}
        stageLabel={stageLabel}
        completionPercent={Number(project.completionPercent)}
        developerName={developerName}
        developerHref={developerHref}
        telegram={telegram}
        website={website}
        projectAmenities={projectAmenities}
      />

      {canEditInventory ? (
        <ProjectInventoryEditor
          units={editableUnits}
          title={inv.editHeading}
          lede={inv.editLede}
          labels={{
            available: inv.available,
            reserved: inv.reserved,
            sold: inv.sold,
            failed: inv.updateFailed,
            floor: inv.floorLabel,
          }}
        />
      ) : null}

      {project.listings.length === 0 ? (
        <p className="text-sm text-slate-600" role="status">
          {translate(dictionary, "pages.emptyDirectory")}
        </p>
      ) : null}
    </PageIntro>
  );
}
