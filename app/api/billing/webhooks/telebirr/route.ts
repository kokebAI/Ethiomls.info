import { NextRequest, NextResponse } from "next/server";
import { BillingProvider } from "@prisma/client";
import {
  SubscriptionBillingEngine,
  subscriptionBillingEngine,
} from "@/lib/billing/SubscriptionBillingEngine";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhooks/telebirr
 * Verifies Telebirr transaction webhooks and updates subscriptions.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const signature =
      request.headers.get("x-telebirr-signature") ??
      request.headers.get("x-signature");

    const signatureOk = SubscriptionBillingEngine.verifyTelebirrSignature(
      payload,
      signature,
    );

    const externalTxnId = String(
      payload.transactionId ?? payload.trxId ?? payload.outTradeNo ?? "",
    ).trim();
    const amountEtb = Number(payload.amount ?? payload.totalAmount ?? 0);
    const userId =
      typeof payload.userId === "string"
        ? payload.userId
        : typeof payload.merchantUserId === "string"
          ? payload.merchantUserId
          : null;

    if (!externalTxnId) {
      return NextResponse.json(
        { error: "ValidationError", message: "transactionId is required" },
        { status: 400 },
      );
    }

    const result = await subscriptionBillingEngine.processWebhook({
      provider: BillingProvider.TELEBIRR,
      externalTxnId,
      userId,
      amountEtb: Number.isFinite(amountEtb) ? amountEtb : 0,
      payload,
      signatureOk,
    });

    return NextResponse.json(
      { ok: signatureOk, provider: "TELEBIRR", result },
      { status: signatureOk ? 200 : 401 },
    );
  } catch (error) {
    console.error("[telebirr webhook]", error);
    return NextResponse.json(
      { error: "WebhookError", message: "Telebirr webhook processing failed" },
      { status: 500 },
    );
  }
}
