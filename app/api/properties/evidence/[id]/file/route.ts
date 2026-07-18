import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * GET /api/properties/evidence/[id]/file
 * Serves staged evidence bytes (inline storage) for the owner or after attach.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sign in required" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const upload = await prisma.evidenceUpload.findUnique({ where: { id } });
  if (upload?.contentBytes && upload.userId === session.userId) {
    return new NextResponse(new Uint8Array(upload.contentBytes), {
      headers: {
        "Content-Type": upload.mimeType,
        "Content-Disposition": `inline; filename="${upload.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const evidence = await prisma.listingEvidence.findUnique({
    where: { id },
    include: { listing: { select: { ownerId: true } } },
  });
  if (
    evidence?.contentBytes &&
    evidence.listing.ownerId === session.userId
  ) {
    return new NextResponse(new Uint8Array(evidence.contentBytes), {
      headers: {
        "Content-Type": evidence.mimeType,
        "Content-Disposition": `inline; filename="${evidence.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  if (evidence && evidence.listing.ownerId === session.userId && evidence.storagePath) {
    return NextResponse.redirect(evidence.publicUrl);
  }

  return NextResponse.json(
    { error: "NotFound", message: "Evidence file not found" },
    { status: 404 },
  );
}
