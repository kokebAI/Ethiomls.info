import { NextResponse } from "next/server";
import { getLiveNbeUsdEtbRate } from "@/lib/compliance/nbeRate";

export const runtime = "nodejs";

/**
 * GET /api/exchange-rate
 * Latest official NBE USD/ETB indicative rate (1-hour server cache).
 */
export async function GET() {
  const rate = await getLiveNbeUsdEtbRate();
  return NextResponse.json(
    {
      data: {
        base: "USD",
        quote: "ETB",
        rate: rate.usdEtb,
        source: rate.source,
        asOf: rate.asOf,
        label:
          rate.source === "nbe"
            ? "NBE indicative rate"
            : "Fallback rate (NBE feed unavailable)",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
