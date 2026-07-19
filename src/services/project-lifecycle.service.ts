import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Publish a project only after admin audit approval.
 */
export async function activateProject(projectId: string): Promise<{
  projectId: string;
  status: ListingStatus;
}> {
  const audited = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      adminAuditApprovedAt: true,
      adminAuditedById: true,
    },
  });

  if (!audited) {
    throw new Error("Project not found");
  }
  if (!audited.adminAuditApprovedAt || !audited.adminAuditedById) {
    throw new Error("Admin audit approval is required before publication");
  }
  if (audited.status !== ListingStatus.PENDING_REVIEW) {
    throw new Error("Only a pending-review project can be published");
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      status: ListingStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  return {
    projectId: project.id,
    status: project.status,
  };
}
