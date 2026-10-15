import { NextRequest, NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { maskE164Phone } from "@/lib/leads/phoneMask";
import { smsNotificationEngine } from "@/src/services/sms.service";

const leadSchema = z.object({
  listingId: z.string().trim().min(1).max(64),
  message: z.string().trim().max(2000).optional(),
  consentAccepted: z.literal(true),
});

export const runtime = "nodejs";

/**
 * POST /api/leads/secure-route
 * Blocks broker phone unmasking until Consent Gate checkbox is confirmed.
 * On consent: captures a Lead row and returns masked routing parameters
 * plus a one-time revealed line for the consented client session.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in required", statusCode: 401 },
        { status: 401 },
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "InvalidJson",
          message: "Request body must be valid JSON",
          statusCode: 400,
        },
        { status: 400 },
      );
    }

    const parsed = leadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message:
            parsed.error.issues[0]?.message ??
            "listingId and consentAccepted are required",
          statusCode: 400,
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const listingId = parsed.data.listingId;
    const requesterId = session.userId;
    const message = parsed.data.message ?? null;

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        owner: {
          select: {
            id: true,
            phone: true,
            fullName: true,
            role: true,
            localePrefs: true,
          },
        },
        delala: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                phone: true,
                fullName: true,
                localePrefs: true,
              },
            },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "NotFound", message: "Listing not found", statusCode: 404 },
        { status: 404 },
      );
    }

    const brokerUser = listing.delala?.user ?? listing.owner;
    // Prefer listing contact line (what buyers see), then broker/owner account phone.
    const rawPhone =
      listing.contactPhone?.trim() ||
      brokerUser.phone?.trim() ||
      null;

    if (!rawPhone) {
      return NextResponse.json(
        {
          error: "ContactUnavailable",
          message: "No broker telephone is registered for this listing",
          statusCode: 404,
        },
        { status: 404 },
      );
    }

    const maskedPhone = maskE164Phone(rawPhone);

    const lead = await prisma.lead.create({
      data: {
        listingId: listing.id,
        requesterId,
        brokerUserId: brokerUser.id,
        delalaId: listing.delalaId,
        status: LeadStatus.ROUTED,
        consentGranted: true,
        consentGrantedAt: new Date(),
        maskedPhone,
        revealedPhone: rawPhone,
        message,
        metadata: {
          source: "secure-route",
          listingId: listing.id,
        },
      },
    });

    // Best-effort SMS to broker/delala — never block lead capture on transport failure.
    void smsNotificationEngine
      .sendTemplate({
        toE164: rawPhone,
        templateId: "new_lead_alert",
        user: brokerUser,
        url: `/leads/${lead.id}`,
      })
      .catch((error) => {
        console.warn("[secure-route] lead SMS failed", error);
      });

    return NextResponse.json(
      {
        ok: true,
        leadId: lead.id,
        status: lead.status,
        consentGranted: true,
        // Masked parameters are always passed for audit / UI chips.
        contact: {
          maskedPhone: lead.maskedPhone,
          revealedPhone: lead.revealedPhone,
          brokerDisplayName: brokerUser.fullName,
        },
        routing: {
          listingId: listing.id,
          delalaId: listing.delalaId,
          brokerUserId: brokerUser.id,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/leads/secure-route]", error);
    return NextResponse.json(
      {
        error: "InternalServerError",
        message: "Failed to route secure lead",
        statusCode: 500,
      },
      { status: 500 },
    );
  }
}
