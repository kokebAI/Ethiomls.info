import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * GET /api/admin/alerts
 * Recent admin alerts + unread count (for header popup / workspace).
 */
export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 },
    );
  }

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 40)
    : 8;
  const unreadOnly = request.nextUrl.searchParams.get("unread") !== "0";

  const [unreadCount, alerts] = await Promise.all([
    prisma.adminAlert.count({ where: { isRead: false } }),
    prisma.adminAlert.findMany({
      where: unreadOnly ? { isRead: false } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        message: true,
        severity: true,
        listingId: true,
        isRead: true,
        createdAt: true,
        type: true,
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      unreadCount,
      alerts: alerts.map((alert) => ({
        ...alert,
        createdAt: alert.createdAt.toISOString(),
      })),
    },
  });
}
