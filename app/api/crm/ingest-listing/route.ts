import { NextRequest, NextResponse } from "next/server";
import { ingestAgtCrmListing } from "@/lib/crm/ingest-listing";

export const runtime = "nodejs";

function assertCrmIngestAuth(req: NextRequest): NextResponse | null {
  const expected =
    process.env.CRM_INGEST_API_KEY?.trim() ||
    process.env.AGT_CRM_API_KEY?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "CRM_INGEST_API_KEY is not configured" },
      { status: 500 },
    );
  }
  const header = req.headers.get("x-crm-api-key")?.trim();
  const auth = req.headers.get("authorization");
  const bearer =
    auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const provided = header || bearer;
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * POST /api/crm/ingest-listing
 * AGT CRM product activation → EthioMLS listing (PENDING_REVIEW).
 * Auth: x-crm-api-key or Bearer = CRM_INGEST_API_KEY (or AGT_CRM_API_KEY).
 */
export async function POST(request: NextRequest) {
  const unauthorized = assertCrmIngestAuth(request);
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await ingestAgtCrmListing(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true, listingId: result.listingId, action: result.action },
    { status: result.action === "created" ? 201 : 200 },
  );
}
