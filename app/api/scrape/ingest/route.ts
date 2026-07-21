import { NextRequest, NextResponse } from "next/server";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import {
  ingestScrapedText,
  runImportSource,
} from "@/lib/imports/run-import";
import { resolveAutoSendFlag } from "@/lib/imports/scrape-invite";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/scrape/ingest
 *
 * Modes:
 * - Text ingest: `{ text, contactPhone?, sourceUrl?, importSourceId?, autoSend? }`
 * - Source re-run: `{ importSourceId }` or `?sourceId=` (uses existing scrapers)
 *
 * Auto vs manual:
 * - `?mode=auto` / `{ autoSend: true }` → parse, save, HaHu invite, SENT
 * - `?mode=manual` / omit autoSend → parse, save, PENDING_REVIEW (no HaHu)
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentOpsStaff();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 },
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

  const sourceId =
    request.nextUrl.searchParams.get("sourceId") ??
    (typeof body.importSourceId === "string"
      ? body.importSourceId
      : typeof body.sourceId === "string"
        ? body.sourceId
        : null);

  const text = typeof body.text === "string" ? body.text.trim() : "";

  try {
    if (text) {
      const result = await ingestScrapedText({
        text,
        ownerId: admin.id,
        sourceUrl:
          typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        contactPhone:
          typeof body.contactPhone === "string" ? body.contactPhone : null,
        contactName:
          typeof body.contactName === "string" ? body.contactName : null,
        importSourceId: sourceId,
        sourcePostedAt:
          typeof body.sourcePostedAt === "string"
            ? body.sourcePostedAt
            : null,
        autoSend,
      });
      return NextResponse.json({
        data: {
          ...result,
          autoSend,
        },
      });
    }

    if (sourceId) {
      const run = await runImportSource({
        sourceId,
        adminUserId: admin.id,
        autoSend,
      });
      return NextResponse.json({ data: { run, autoSend } });
    }

    return NextResponse.json(
      {
        error: "BadRequest",
        message:
          "Provide scraped `text` or an `importSourceId` / `sourceId` to run.",
      },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scrape ingest failed";
    return NextResponse.json(
      { error: "IngestFailed", message },
      { status: 502 },
    );
  }
}
