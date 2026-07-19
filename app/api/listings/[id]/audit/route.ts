import { NextRequest, NextResponse } from "next/server";
import { ListingStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const checklistSchema = z.object({
  sellerIdentity: z.boolean(),
  ownershipOrAuthority: z.boolean(),
  priceAndPaymentTerms: z.boolean(),
  locationAndUnitDetails: z.boolean(),
  mediaAuthenticity: z.boolean(),
  permitAndConstructionStage: z.boolean(),
  escrowCompliance: z.boolean(),
  contactAndConsent: z.boolean(),
  duplicateAndFraudScreen: z.boolean(),
});

const auditSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    notes: z.string().trim().max(4000).default(""),
    checklist: checklistSchema,
  })
  .superRefine((value, ctx) => {
    const minNotes = value.decision === "REJECT" ? 5 : 10;
    if (value.notes.length < minNotes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message:
          value.decision === "REJECT"
            ? "Provide a reject reason (min. 5 characters)"
            : "Provide an approval reason (min. 10 characters)",
      });
    }
  });

/**
 * POST /api/listings/[id]/audit
 * Records an accountable admin decision. Approval does not publish; the
 * separate activation endpoint performs the final publication gate.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "InvalidJson", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = auditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message:
          parsed.error.issues[0]?.message ??
          "Invalid audit payload — check notes and checklist",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!listing) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }
  if (listing.status === ListingStatus.PUBLISHED) {
    return NextResponse.json(
      {
        error: "AlreadyPublished",
        message: "Unpublish the listing before changing its audit decision",
      },
      { status: 409 },
    );
  }

  const { decision, checklist, notes } = parsed.data;
  const allChecksPassed = Object.values(checklist).every(Boolean);
  if (decision === "APPROVE" && !allChecksPassed) {
    return NextResponse.json(
      {
        error: "IncompleteAudit",
        message: "Every client-protection check must pass before approval",
      },
      { status: 422 },
    );
  }

  const approved = decision === "APPROVE";
  const updated = await prisma.listing.update({
    where: { id },
    data: {
      status: approved ? ListingStatus.PENDING_REVIEW : ListingStatus.DRAFT,
      publishedAt: null,
      adminAuditApprovedAt: approved ? new Date() : null,
      adminAuditedById: admin.id,
      adminAuditNotes: notes,
      adminAuditChecklist: checklist,
    },
    select: {
      id: true,
      status: true,
      adminAuditApprovedAt: true,
      adminAuditedById: true,
    },
  });

  return NextResponse.json({
    data: updated,
    decision,
    publishable: approved,
  });
}
