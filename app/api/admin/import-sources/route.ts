import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { normalizeImportSourceInput } from "@/lib/imports/normalize-source";

export const runtime = "nodejs";

const createSchema = z.object({
  url: z.string().trim().min(3).max(500),
  label: z.string().trim().min(2).max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
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
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
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
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "Provide a Telegram handle/URL or website URL",
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

    return NextResponse.json({ data: source }, { status: 201 });
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
