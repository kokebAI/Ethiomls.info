import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { runImportSource } from "@/lib/imports/run-import";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
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
  const source = await prisma.importSource.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!source) {
    return NextResponse.json(
      { error: "NotFound", message: "Import source not found" },
      { status: 404 },
    );
  }
  if (!source.isActive) {
    return NextResponse.json(
      { error: "Inactive", message: "Re-activate the source before scraping" },
      { status: 409 },
    );
  }

  try {
    const run = await runImportSource({
      sourceId: id,
      adminUserId: admin.id,
    });
    return NextResponse.json({ data: run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scrape run failed";
    return NextResponse.json(
      { error: "ScrapeFailed", message },
      { status: 502 },
    );
  }
}
