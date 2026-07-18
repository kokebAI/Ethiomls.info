import { NextRequest, NextResponse } from "next/server";
import { ListingEvidenceKind, ListingStatus } from "@prisma/client";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import {
  EVIDENCE_KIND_LABELS,
  MAX_EVIDENCE_FILE_BYTES,
} from "@/lib/properties/evidence";
import { storeEvidenceBytes } from "@/lib/storage/listing-media";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACCEPTED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const KIND_SET = new Set(Object.values(ListingEvidenceKind));

function resolveMime(file: File): string {
  if (ACCEPTED.has(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return file.type;
}

/**
 * POST /api/listings/[id]/media
 * Admin-only multipart upload of photos/docs onto a pending listing.
 * Fields: `files` (or `file`) repeated, optional `kind` (default UNIT_GALLERY),
 * optional `as360=1` to also append image URLs to panoramicImageUrls.
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
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      images: true,
      galleryImageUrls: true,
      coverImageUrl: true,
      panoramicImageUrls: true,
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
        message: "Cannot attach media to a published listing here",
      },
      { status: 409 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "InvalidForm", message: "Expected multipart form data" },
      { status: 400 },
    );
  }

  const kindRaw = String(formData.get("kind") ?? "UNIT_GALLERY").trim();
  if (!KIND_SET.has(kindRaw as ListingEvidenceKind)) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: `kind must be one of: ${Object.keys(EVIDENCE_KIND_LABELS).join(", ")}`,
      },
      { status: 400 },
    );
  }
  const kind = kindRaw as ListingEvidenceKind;
  const as360 = String(formData.get("as360") ?? "") === "1";

  const files: File[] = [];
  for (const key of ["files", "file", "photos", "documents"]) {
    for (const value of formData.getAll(key)) {
      if (value instanceof File && value.size > 0) files.push(value);
    }
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "ValidationError", message: "At least one file is required" },
      { status: 400 },
    );
  }
  if (files.length > 12) {
    return NextResponse.json(
      { error: "ValidationError", message: "Upload at most 12 files at once" },
      { status: 400 },
    );
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://ethiomls.info";

  const uploaded: Array<{
    id: string;
    kind: ListingEvidenceKind;
    fileName: string;
    publicUrl: string;
    label: string;
  }> = [];
  const imageUrls: string[] = [];

  for (const file of files) {
    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      return NextResponse.json(
        {
          error: "FileTooLarge",
          message: `${file.name} must be under ${(MAX_EVIDENCE_FILE_BYTES / (1024 * 1024)).toFixed(1)} MB`,
        },
        { status: 413 },
      );
    }
    const mimeType = resolveMime(file);
    if (!ACCEPTED.has(mimeType)) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: `${file.name}: only PDF, JPEG, PNG, and WebP are supported`,
        },
        { status: 400 },
      );
    }
    if (kind === ListingEvidenceKind.UNIT_GALLERY && mimeType === "application/pdf") {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: "Gallery photos must be JPEG, PNG, or WebP",
        },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeEvidenceBytes({
      userId: admin.id,
      kind,
      fileName: file.name,
      mimeType,
      bytes,
    });

    const row = await prisma.listingEvidence.create({
      data: {
        listingId: id,
        kind,
        fileName: file.name.slice(0, 200),
        mimeType,
        byteSize: bytes.length,
        storagePath: stored.storagePath,
        publicUrl: stored.publicUrl || "pending",
        contentBytes: stored.contentBytes
          ? new Uint8Array(stored.contentBytes)
          : null,
      },
    });

    const publicUrl =
      stored.publicUrl ||
      `${site}/api/properties/evidence/${row.id}/file`;
    const finalRow =
      publicUrl !== row.publicUrl
        ? await prisma.listingEvidence.update({
            where: { id: row.id },
            data: { publicUrl },
          })
        : row;

    uploaded.push({
      id: finalRow.id,
      kind: finalRow.kind,
      fileName: finalRow.fileName,
      publicUrl: finalRow.publicUrl,
      label: EVIDENCE_KIND_LABELS[finalRow.kind],
    });

    if (mimeType.startsWith("image/")) {
      imageUrls.push(finalRow.publicUrl);
    }
  }

  const nextGallery = [
    ...new Set([
      ...listing.galleryImageUrls,
      ...listing.images,
      ...(kind === ListingEvidenceKind.UNIT_GALLERY ? imageUrls : []),
    ]),
  ];
  const nextPanoramas = as360
    ? [...new Set([...listing.panoramicImageUrls, ...imageUrls])]
    : listing.panoramicImageUrls;

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...(kind === ListingEvidenceKind.UNIT_GALLERY && imageUrls.length > 0
        ? {
            galleryImageUrls: nextGallery,
            images: nextGallery,
            coverImageUrl: listing.coverImageUrl || nextGallery[0] || null,
          }
        : {}),
      ...(as360 && imageUrls.length > 0
        ? {
            panoramicImageUrls: nextPanoramas,
            ...(nextPanoramas[0] ? { tourUrl: nextPanoramas[0] } : {}),
          }
        : {}),
    },
    select: {
      id: true,
      coverImageUrl: true,
      galleryImageUrls: true,
      panoramicImageUrls: true,
      tourUrl: true,
    },
  });

  return NextResponse.json({ data: { listing: updated, uploads: uploaded } });
}
