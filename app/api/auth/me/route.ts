import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * Current signed-in user (or null) — used by the header to render auth state.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: { id: true, fullName: true, phone: true, role: true },
  });

  return NextResponse.json({ user: user ?? null });
}
