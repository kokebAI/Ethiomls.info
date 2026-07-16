import { NextRequest, NextResponse } from "next/server";
import { BillingProvider } from "@prisma/client";
import {
  SubscriptionBillingEngine,
  subscriptionBillingEngine,
} from "@/lib/billing/SubscriptionBillingEngine";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhooks/cbe-birr
 * Verifies CBE Birr transaction webhooks and updates subscriptions.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const signature =
      request.headers.get("x-cbe-birr-signature") ??
      request.headers.get("x-signature");

    const signatureOk = SubscriptionBillingEngine.verifyCbeBirrSignature(
      payload,
      signature,
    );

    const externalTxnId = String(
      payload.ftNumber ?? payload.transactionId ?? payload.reference ?? "",
    ).trim();
    const amountEtb = Number(payload.amount ?? payload.creditedAmount ?? 0);
    const userId =
      typeof payload.userId === "string"
        ? payload.userId
        : typeof payload.customerRef === "string"
          ? payload.customerRef
          : null;

    if (!externalTxnId) {
      return NextResponse.json(
        { error: "ValidationError", message: "ftNumber/transactionId is required" },
        { status: 400 },
      );
    }

    const result = await subscriptionBillingEngine.processWebhook({
      provider: BillingProvider.CBE_BIRR,
      externalTxnId,
      userId,
      amountEtb: Number.isFinite(amountEtb) ? amountEtb : 0,
      payload,
      signatureOk,
    });

    return NextResponse.json(
      { ok: signatureOk, provider: "CBE_BIRR", result },
      { status: signatureOk ? 200 : 401 },
    );
  } catch (error) {
    console.error("[cbe-birr webhook]", error);
    return NextResponse.json(
      { error: "WebhookError", message: "CBE Birr webhook processing failed" },
      { status: 500 },
    );
  }
}
