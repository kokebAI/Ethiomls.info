import { NextRequest, NextResponse } from "next/server";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { deleteImportSourceAndScrapes } from "@/lib/imports/delete-scrape-data";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * DELETE /api/admin/import-sources/[id]
 * Removes the source, its scrape runs, and all listings imported from it.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentOpsStaff();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const source = await prisma.importSource.findUnique({
    where: { id },
    select: { id: true, label: true },
  });
  if (!source) {
    return NextResponse.json(
      { error: "NotFound", message: "Import source not found" },
      { status: 404 },
    );
  }

  try {
    const result = await deleteImportSourceAndScrapes(id);
    return NextResponse.json({
      data: {
        id: source.id,
        label: source.label,
        ...result,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete import source";
    return NextResponse.json(
      { error: "DeleteFailed", message },
      { status: 500 },
    );
  }
}
