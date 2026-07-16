import { NextRequest, NextResponse } from "next/server";
import { BillingProvider } from "@prisma/client";
import {
  DELALA_STANDARD_UPFRONT_ETB,
  SubscriptionBillingEngine,
} from "@/lib/billing/SubscriptionBillingEngine";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * POST /api/billing/subscriptions/evaluate
 * Evaluates / provisions subscription state for a user (pilot exemption aware).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      requestedAmountEtb?: number;
      provider?: "TELEBIRR" | "CBE_BIRR";
    };

    if (!body.userId) {
      return NextResponse.json(
        { error: "ValidationError", message: "userId is required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: body.userId } });
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
