import { NextRequest, NextResponse } from "next/server";
import { BillingProvider } from "@prisma/client";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { getSession } from "@/lib/auth/session";
import {
  DELALA_STANDARD_UPFRONT_ETB,
  SubscriptionBillingEngine,
} from "@/lib/billing/SubscriptionBillingEngine";
import { prisma } from "@/lib/db/prisma";

const bodySchema = z.object({
  userId: z.string().trim().min(1).max(64).optional(),
  requestedAmountEtb: z.number().finite().nonnegative().max(10_000_000).optional(),
  provider: z.enum(["TELEBIRR", "CBE_BIRR"]).optional(),
});

export const runtime = "nodejs";

/**
 * POST /api/billing/subscriptions/evaluate
 * Evaluates / provisions subscription state for a user (pilot exemption aware).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in required" },
        { status: 401 },
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "InvalidJson", message: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: parsed.error.issues[0]?.message ?? "Invalid subscription payload",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const targetUserId = parsed.data.userId ?? session.userId;
    if (targetUserId !== session.userId) {
      const admin = await getCurrentAdmin();
      if (!admin) {
        return NextResponse.json(
          { error: "Forbidden", message: "You can only evaluate your own subscription" },
          { status: 403 },
        );
      }
    }

    const body = parsed.data;
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      return NextResponse.json(
        { error: "NotFound", message: "User not found" },
        { status: 404 },
      );
    }

    const requested =
      typeof body.requestedAmountEtb === "number"
        ? body.requestedAmountEtb
        : DELALA_STANDARD_UPFRONT_ETB;

    const settled = SubscriptionBillingEngine.resolveUpfrontAmountEtb(
      user,
      requested,
    );

    const provider =
      body.provider === "CBE_BIRR"
        ? BillingProvider.CBE_BIRR
        : body.provider === "TELEBIRR"
          ? BillingProvider.TELEBIRR
          : null;

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        planCode: "delala-standard",
        status: settled.status,
        amountEtb: settled.amountEtb,
        pilotExempt: settled.pilotExempt,
        billingProvider: provider ?? undefined,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        status: settled.status,
        amountEtb: settled.amountEtb,
        pilotExempt: settled.pilotExempt,
        billingProvider: provider ?? undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        amountEtb: Number(subscription.amountEtb),
        pilotExempt: subscription.pilotExempt,
        planCode: subscription.planCode,
      },
      rule:
        settled.pilotExempt
          ? "INDEPENDENT_DELALA operational pilot exemption — upfront billing = 0 ETB"
          : "Standard upfront billing model applied",
    });
  } catch (error) {
    console.error("[subscriptions/evaluate]", error);
    return NextResponse.json(
      { error: "InternalServerError", message: "Subscription evaluation failed" },
      { status: 500 },
    );
  }
}
