import { NextRequest, NextResponse } from "next/server";
import { crmIngestApiKey } from "@/lib/crm/ingest-auth";
import { ingestAgtCrmListing } from "@/lib/crm/ingest-listing";

export const runtime = "nodejs";

function assertCrmIngestAuth(req: NextRequest): NextResponse | null {
  const expected = crmIngestApiKey();
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "CRM ingest is not configured. Set CRM_INGEST_API_KEY or CRM_APP_API_KEY.",
      },
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
 * Auth: x-crm-api-key or Bearer = CRM_INGEST_API_KEY, AGT_CRM_API_KEY,
 * or CRM_APP_API_KEY (the key already set on Telecloud).
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
