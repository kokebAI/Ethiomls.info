import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const readSchema = z.object({
  ids: z.array(z.string().min(1)).max(50).optional(),
  all: z.boolean().optional(),
});

/**
 * POST /api/admin/alerts/read
 * Mark one, many, or all admin alerts as read.
 */
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

  const parsed = readSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", message: "Provide ids or all: true" },
      { status: 400 },
    );
  }

  const { ids, all } = parsed.data;
  if (!all && (!ids || ids.length === 0)) {
    return NextResponse.json(
      { error: "ValidationError", message: "Provide ids or all: true" },
      { status: 400 },
    );
  }

  const result = await prisma.adminAlert.updateMany({
    where: all ? { isRead: false } : { id: { in: ids! }, isRead: false },
    data: { isRead: true },
  });

  const unreadCount = await prisma.adminAlert.count({
    where: { isRead: false },
  });

  return NextResponse.json({
    data: { marked: result.count, unreadCount },
  });
}
