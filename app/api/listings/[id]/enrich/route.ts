import { NextRequest, NextResponse } from "next/server";
import { ListingStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { listingUpdateFromSalesKitDraft } from "@/lib/imports/apply-sales-kit-draft";
import { ADDIS_SUB_CITY_SET } from "@/lib/properties/subCities";

export const runtime = "nodejs";

const draftSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).default(""),
  price: z.number().finite().nonnegative().default(0),
  currency: z.enum(["ETB", "USD"]).default("ETB"),
  subCity: z.string().trim().default("bole"),
  addressLine: z.string().trim().max(300).optional().default(""),
  bedrooms: z.number().int().nonnegative().default(0),
  bathrooms: z.number().int().nonnegative().default(0),
  sizeM2: z.number().finite().nonnegative().default(0),
  floor: z.number().int().optional().nullable(),
  unitLabel: z.string().trim().max(40).optional().nullable(),
  listingType: z.enum(["SALE", "RENT", "OFF_PLAN"]).default("OFF_PLAN"),
  category: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "LAND"])
    .default("RESIDENTIAL"),
  projectName: z.string().trim().max(200).optional().nullable(),
});

const enrichSchema = z.object({
  draft: draftSchema.optional(),
  editReason: z.string().trim().min(10).max(4000).optional(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  contactName: z.string().trim().max(120).optional().nullable(),
  tourUrl: z.string().trim().url().max(2000).optional().nullable(),
  panoramicImageUrls: z.array(z.string().url().max(2000)).max(12).optional(),
  photoUrls: z.array(z.string().url().max(2000)).max(24).optional(),
});

/**
 * PATCH /api/listings/[id]/enrich
 * Admin-only: apply parsed sales-kit fields / photos / 360 URLs onto a pending listing.
 */
export async function PATCH(
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

  const parsed = enrichSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Invalid enrich payload",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      images: true,
      galleryImageUrls: true,
      coverImageUrl: true,
      panoramicImageUrls: true,
      metadataTags: true,
      adminAuditNotes: true,
    },
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
        message: "Published listings cannot be enriched here — unpublish first.",
      },
      { status: 409 },
    );
  }

  const data = parsed.data;
  if (data.draft && (!data.editReason || data.editReason.length < 10)) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message:
          "Provide an edit reason (min. 10 characters) before applying changes",
      },
      { status: 400 },
    );
  }
  if (
    !data.draft &&
    data.contactPhone === undefined &&
    data.contactName === undefined &&
    data.tourUrl === undefined &&
    !data.panoramicImageUrls &&
    !data.photoUrls
  ) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Provide a draft, photos, contact, or 360 URLs to apply",
      },
      { status: 400 },
    );
  }

  let subCityId: string | null | undefined;
  if (data.draft) {
    const code = ADDIS_SUB_CITY_SET.has(data.draft.subCity)
      ? data.draft.subCity
      : "bole";
    const subCity = await prisma.subCity.findUnique({
      where: { code },
      select: { id: true },
    });
    subCityId = subCity?.id ?? null;
  }

  const photoUrls = data.photoUrls ?? [];
  const nextGallery = [
    ...new Set([...listing.galleryImageUrls, ...listing.images, ...photoUrls]),
  ];
  const nextPanoramas = data.panoramicImageUrls
    ? [...new Set([...listing.panoramicImageUrls, ...data.panoramicImageUrls])]
    : undefined;

  const tags = new Set(listing.metadataTags);
  tags.add("admin-audit-enrich");
  if (data.draft?.projectName) {
    tags.add(`project:${data.draft.projectName.slice(0, 60)}`);
  }
  if (data.draft?.unitLabel) {
    tags.add(`unit:${data.draft.unitLabel.slice(0, 40)}`);
  }
  if (data.draft?.floor != null) {
    tags.add(`floor:${data.draft.floor}`);
  }

  const editNote = data.editReason?.trim();
  const nextAuditNotes = editNote
    ? [listing.adminAuditNotes?.trim(), `Edit: ${editNote}`]
        .filter(Boolean)
        .join("\n")
        .slice(0, 4000)
    : undefined;

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...(data.draft
        ? listingUpdateFromSalesKitDraft(data.draft, subCityId ?? null)
        : {}),
      ...(nextAuditNotes ? { adminAuditNotes: nextAuditNotes } : {}),
      ...(data.contactPhone !== undefined
        ? { contactPhone: data.contactPhone || null }
        : {}),
      ...(data.contactName !== undefined
        ? { contactName: data.contactName || null }
        : {}),
      ...(data.tourUrl !== undefined ? { tourUrl: data.tourUrl || null } : {}),
      ...(photoUrls.length > 0
        ? {
            galleryImageUrls: nextGallery,
            images: nextGallery,
            coverImageUrl: listing.coverImageUrl || nextGallery[0] || null,
          }
        : {}),
      ...(nextPanoramas
        ? {
            panoramicImageUrls: nextPanoramas,
            tourUrl: data.tourUrl ?? nextPanoramas[0] ?? undefined,
          }
        : {}),
      metadataTags: [...tags],
    },
    select: {
      id: true,
      status: true,
      coverImageUrl: true,
      galleryImageUrls: true,
      panoramicImageUrls: true,
      tourUrl: true,
    },
  });

  return NextResponse.json({ data: updated });
}
