import { NextResponse } from "next/server";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { collectIntegrationStatuses } from "@/lib/ops/integration-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/integrations-status
 * Live config + health chips for the admin workspace services panel.
 */
export async function GET() {
  const admin = await getCurrentOpsStaff();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 },
    );
  }

  const integrations = await collectIntegrationStatuses();
  return NextResponse.json({ integrations });
}
