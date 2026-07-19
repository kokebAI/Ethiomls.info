import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { activateProject } from "@/src/services/project-lifecycle.service";

export const runtime = "nodejs";

/**
 * POST /api/projects/[id]/activate
 * Publishes a project after admin audit approval.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "An active admin account is required to publish projects",
          statusCode: 403,
        },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: "project id required",
          statusCode: 400,
        },
        { status: 400 },
      );
    }

    const result = await activateProject(id.trim());
    return NextResponse.json(
      {
        ok: true,
        projectId: result.projectId,
        status: result.status,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/projects/[id]/activate]", error);
    const message =
      error instanceof Error ? error.message : "Failed to activate project";
    const isAuditBlock =
      message.includes("audit") || message.includes("pending-review");
    return NextResponse.json(
      {
        error: isAuditBlock ? "AuditRequired" : "InternalServerError",
        message,
        statusCode: isAuditBlock ? 422 : 500,
      },
      { status: isAuditBlock ? 422 : 500 },
    );
  }
}
