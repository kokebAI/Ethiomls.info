import {
  BillingProvider,
  Prisma,
  SubscriptionStatus,
  UserRole,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type BillingWebhookInput = {
  provider: BillingProvider;
  externalTxnId: string;
  userId?: string | null;
  amountEtb: number;
  payload: Record<string, unknown>;
  signatureOk: boolean;
};

export type BillingProcessResult = {
  eventId: string;
  subscriptionId: string | null;
  status: SubscriptionStatus;
  amountEtb: number;
  pilotExempt: boolean;
  notes: string;
};

/** Standard upfront listing/contact plan for brokers (ETB). */
export const DELALA_STANDARD_UPFRONT_ETB = 499;

/**
 * Automates Telebirr + CBE Birr subscription verification and pilot exemptions.
 */
export class SubscriptionBillingEngine {
  /**
   * Independent delala operational pilot: upfront billing model forced to 0 ETB.
   */
  static resolveUpfrontAmountEtb(user: Pick<User, "role">, requestedEtb: number): {
    amountEtb: number;
    pilotExempt: boolean;
    status: SubscriptionStatus;
  } {
    if (user.role === UserRole.INDEPENDENT_DELALA) {
      return {
        amountEtb: 0,
        pilotExempt: true,
        status: SubscriptionStatus.EXEMPT,
      };
    }

    return {
      amountEtb: Math.max(0, requestedEtb),
      pilotExempt: false,
      status:
        requestedEtb <= 0 ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
    };
  }

  static verifyTelebirrSignature(
    payload: Record<string, unknown>,
    signatureHeader: string | null,
  ): boolean {
    // Mock verifier — accept explicit test signatures or configured secret echo.
    const secret = process.env.TELEBIRR_WEBHOOK_SECRET ?? "telebirr-dev-secret";
    if (!signatureHeader) return false;
    if (signatureHeader === `sha256=${secret}`) return true;
    const txn = String(payload.transactionId ?? payload.trxId ?? "");
    return signatureHeader === `mock:${txn}`;
  }

  static verifyCbeBirrSignature(
    payload: Record<string, unknown>,
    signatureHeader: string | null,
  ): boolean {
    const secret = process.env.CBE_BIRR_WEBHOOK_SECRET ?? "cbe-birr-dev-secret";
    if (!signatureHeader) return false;
    if (signatureHeader === `sha256=${secret}`) return true;
    const txn = String(payload.ftNumber ?? payload.transactionId ?? "");
    return signatureHeader === `mock:${txn}`;
  }

  async processWebhook(input: BillingWebhookInput): Promise<BillingProcessResult> {
    const existing = await prisma.billingWebhookEvent.findUnique({
      where: {
        provider_externalTxnId: {
          provider: input.provider,
          externalTxnId: input.externalTxnId,
        },
      },
    });

    if (existing?.processed) {
      const sub = existing.userId
        ? await prisma.subscription.findUnique({ where: { userId: existing.userId } })
        : null;
      return {
        eventId: existing.id,
        subscriptionId: sub?.id ?? null,
        status: sub?.status ?? SubscriptionStatus.TRIAL,
        amountEtb: Number(existing.amountEtb ?? 0),
        pilotExempt: Boolean(sub?.pilotExempt),
        notes: "Idempotent replay — already processed",
      };
    }

    const event = existing
      ? await prisma.billingWebhookEvent.update({
          where: { id: existing.id },
          data: {
            payload: input.payload as Prisma.InputJsonValue,
            signatureOk: input.signatureOk,
            amountEtb: input.amountEtb,
            userId: input.userId ?? undefined,
          },
        })
      : await prisma.billingWebhookEvent.create({
          data: {
            provider: input.provider,
            externalTxnId: input.externalTxnId,
            payload: input.payload as Prisma.InputJsonValue,
            signatureOk: input.signatureOk,
            amountEtb: input.amountEtb,
            userId: input.userId ?? undefined,
          },
        });

    if (!input.signatureOk) {
      await prisma.billingWebhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          notes: "Rejected — signature verification failed",
        },
      });
      return {
        eventId: event.id,
        subscriptionId: null,
        status: SubscriptionStatus.PAST_DUE,
        amountEtb: input.amountEtb,
        pilotExempt: false,
        notes: "Rejected — signature verification failed",
      };
    }

    if (!input.userId) {
      await prisma.billingWebhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          notes: "Verified deposit without bound userId",
        },
      });
      return {
        eventId: event.id,
        subscriptionId: null,
        status: SubscriptionStatus.ACTIVE,
        amountEtb: input.amountEtb,
        pilotExempt: false,
        notes: "Verified — no user binding",
      };
    }

    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      await prisma.billingWebhookEvent.update({
        where: { id: event.id },
        data: { processed: true, notes: "User not found for webhook" },
      });
      return {
        eventId: event.id,
        subscriptionId: null,
        status: SubscriptionStatus.PAST_DUE,
        amountEtb: input.amountEtb,
        pilotExempt: false,
        notes: "User not found",
      };
    }

    const settled = SubscriptionBillingEngine.resolveUpfrontAmountEtb(
      user,
      input.amountEtb,
    );

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
        billingProvider: input.provider,
        lastExternalTxnId: input.externalTxnId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        status: settled.status,
        amountEtb: settled.amountEtb,
        pilotExempt: settled.pilotExempt,
        billingProvider: input.provider,
        lastExternalTxnId: input.externalTxnId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    const notes = settled.pilotExempt
      ? "INDEPENDENT_DELALA pilot exemption — upfront billing set to 0 ETB"
      : `Subscription activated via ${input.provider}`;

    await prisma.billingWebhookEvent.update({
      where: { id: event.id },
      data: {
        processed: true,
        amountEtb: settled.amountEtb,
        userId: user.id,
        notes,
      },
    });

    return {
      eventId: event.id,
      subscriptionId: subscription.id,
      status: subscription.status,
      amountEtb: Number(subscription.amountEtb),
      pilotExempt: subscription.pilotExempt,
      notes,
    };
  }
}

export const subscriptionBillingEngine = new SubscriptionBillingEngine();
