import { NextResponse } from "next/server";
import { recordPageView } from "@/lib/analytics/page-views";

export const runtime = "nodejs";

/**
 * POST /api/analytics/pageview
 * Lightweight beacon — increments today's UTC page-view counter.
 */
export async function POST() {
  try {
    await recordPageView();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[pageview] failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
