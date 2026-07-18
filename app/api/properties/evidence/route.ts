import { NextRequest, NextResponse } from "next/server";
import { ListingEvidenceKind } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  MAX_EVIDENCE_FILE_BYTES,
  EVIDENCE_KIND_LABELS,
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
 * POST /api/properties/evidence
 * Multipart: `file` + `kind` (ListingEvidenceKind). Session required.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sign in required" },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const kindRaw = String(formData.get("kind") ?? "").trim();
    const file = formData.get("file") ?? formData.get("document");

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

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "ValidationError", message: "A document file is required" },
        { status: 400 },
      );
    }

    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      return NextResponse.json(
        {
          error: "FileTooLarge",
          message: `File must be under ${(MAX_EVIDENCE_FILE_BYTES / (1024 * 1024)).toFixed(1)} MB`,
        },
        { status: 413 },
      );
    }

    const mimeType = resolveMime(file);
    if (!ACCEPTED.has(mimeType)) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: "Only PDF, JPEG, PNG, and WebP are supported",
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
      userId: session.userId,
      kind,
      fileName: file.name,
      mimeType,
      bytes,
    });

    const site =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://ethiomls.info";

    const row = await prisma.evidenceUpload.create({
      data: {
        userId: session.userId,
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
      stored.publicUrl || `${site}/api/properties/evidence/${row.id}/file`;

    const updated =
      publicUrl !== row.publicUrl
        ? await prisma.evidenceUpload.update({
            where: { id: row.id },
            data: { publicUrl },
          })
        : row;

    return NextResponse.json({
      data: {
        id: updated.id,
        kind: updated.kind,
        fileName: updated.fileName,
        mimeType: updated.mimeType,
        byteSize: updated.byteSize,
        publicUrl: updated.publicUrl,
        label: EVIDENCE_KIND_LABELS[updated.kind],
      },
    });
  } catch (error) {
    console.error("[POST /api/properties/evidence]", error);
    return NextResponse.json(
      { error: "InternalServerError", message: "Upload failed" },
      { status: 500 },
    );
  }
}
