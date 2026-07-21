import { NextRequest, NextResponse } from "next/server";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { runImportSource } from "@/lib/imports/run-import";
import { resolveAutoSendFlag } from "@/lib/imports/scrape-invite";

export const runtime = "nodejs";
/** Facebook HTML can be large; keep under platform limits but above common hangs. */
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
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

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      body = raw as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const autoSend = resolveAutoSendFlag({
    searchParams: request.nextUrl.searchParams,
    body,
  });

  try {
    const run = await runImportSource({
      sourceId: id,
      adminUserId: admin.id,
      autoSend,
    });
    return NextResponse.json({ data: run, autoSend });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scrape run failed";
    return NextResponse.json(
      { error: "ScrapeFailed", message },
      { status: 502 },
    );
  }
}
