import { NextRequest, NextResponse } from "next/server";
import { ImportSourceType } from "@prisma/client";
import { z } from "zod";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { fetchPublicText } from "@/lib/imports/fetch-safe";
import { normalizeImportSourceInput } from "@/lib/imports/normalize-source";

export const runtime = "nodejs";
/** Telegram public-preview probe on create can take a few seconds. */
export const maxDuration = 30;

const createSchema = z.object({
  url: z.string().trim().min(3).max(500),
  label: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

async function telegramPreviewWarning(
  normalizedUrl: string,
): Promise<string | null> {
  try {
    const { html } = await fetchPublicText(normalizedUrl);
    if (
      !html.includes("tgme_widget_message") &&
      html.includes("tgme_page_description")
    ) {
      return "Saved, but this Telegram handle is not a public channel preview — Scrape now will fail until the channel enables public t.me/s/… access.";
    }
  } catch {
    // Network probe is best-effort; scrape will report the real error later.
  }
  return null;
}

export async function GET() {
  const admin = await getCurrentOpsStaff();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 },
    );
  }

  const sources = await prisma.importSource.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
      _count: { select: { listings: true } },
    },
  });

  return NextResponse.json({ data: sources });
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentOpsStaff();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "InvalidJson", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path?.[0];
    let message =
      "Provide a Telegram handle/URL, Facebook Page, or website URL";
    if (field === "label") {
      message = "Label must be at least 2 characters (or leave it blank)";
    } else if (field === "notes") {
      message = "Notes must be under 2000 characters";
    } else if (field === "url") {
      message =
        "URL must be a Telegram @handle, Facebook Page, or website (at least 3 characters)";
    }
    return NextResponse.json(
      {
        error: "ValidationError",
        message,
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const normalized = normalizeImportSourceInput(parsed.data.url);
    const source = await prisma.importSource.upsert({
      where: { normalizedUrl: normalized.normalizedUrl },
      update: {
        label: parsed.data.label?.trim() || normalized.labelSuggestion,
        url: normalized.url,
        sourceType: normalized.sourceType,
        telegramHandle: normalized.telegramHandle,
        notes: parsed.data.notes?.trim() || null,
        isActive: true,
      },
      create: {
        label: parsed.data.label?.trim() || normalized.labelSuggestion,
        url: normalized.url,
        normalizedUrl: normalized.normalizedUrl,
        sourceType: normalized.sourceType,
        telegramHandle: normalized.telegramHandle,
        notes: parsed.data.notes?.trim() || null,
        createdById: admin.id,
      },
    });

    const warning =
      normalized.sourceType === ImportSourceType.TELEGRAM
        ? await telegramPreviewWarning(normalized.normalizedUrl)
        : null;

    return NextResponse.json({ data: source, warning }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "InvalidSource",
        message:
          error instanceof Error ? error.message : "Could not save source",
      },
      { status: 400 },
    );
  }
}
