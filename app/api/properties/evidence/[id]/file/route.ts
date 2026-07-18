import { NextRequest, NextResponse } from "next/server";
import { ListingEvidenceKind, UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * GET /api/properties/evidence/[id]/file
 * Serves staged evidence bytes. Gallery photos are public; other docs require
 * the listing owner or an admin session.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const { id } = await context.params;

  const upload = await prisma.evidenceUpload.findUnique({ where: { id } });
  if (upload?.contentBytes) {
    const allowed =
      session &&
      (upload.userId === session.userId ||
        (await prisma.user.findFirst({
          where: {
            id: session.userId,
            role: UserRole.ADMIN,
            isActive: true,
          },
          select: { id: true },
        })));
    if (allowed) {
      return new NextResponse(new Uint8Array(upload.contentBytes), {
        headers: {
          "Content-Type": upload.mimeType,
          "Content-Disposition": `inline; filename="${upload.fileName.replace(/"/g, "")}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const evidence = await prisma.listingEvidence.findUnique({
    where: { id },
    include: { listing: { select: { ownerId: true } } },
  });
  if (!evidence) {
    return NextResponse.json(
      { error: "NotFound", message: "Evidence file not found" },
      { status: 404 },
    );
  }

  const isGallery = evidence.kind === ListingEvidenceKind.UNIT_GALLERY;
  let isAdmin = false;
  if (session) {
    isAdmin = Boolean(
      await prisma.user.findFirst({
        where: {
          id: session.userId,
          role: UserRole.ADMIN,
          isActive: true,
        },
        select: { id: true },
      }),
    );
  }
  const allowed =
    isGallery ||
    (session &&
      (evidence.listing.ownerId === session.userId || isAdmin));

  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden", message: "Sign in required" },
      { status: 403 },
    );
  }

  if (evidence.contentBytes) {
    return new NextResponse(new Uint8Array(evidence.contentBytes), {
      headers: {
        "Content-Type": evidence.mimeType,
        "Content-Disposition": `inline; filename="${evidence.fileName.replace(/"/g, "")}"`,
        "Cache-Control": isGallery
          ? "public, max-age=86400"
          : "private, max-age=3600",
      },
    });
  }

  if (evidence.storagePath && evidence.publicUrl) {
    return NextResponse.redirect(evidence.publicUrl);
  }

  return NextResponse.json(
    { error: "NotFound", message: "Evidence file not found" },
    { status: 404 },
  );
}
