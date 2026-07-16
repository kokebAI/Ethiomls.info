import { NextRequest, NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isConsentAccepted, maskE164Phone } from "@/lib/leads/phoneMask";
import { smsNotificationEngine } from "@/src/services/sms.service";

export const runtime = "nodejs";

/**
 * POST /api/leads/secure-route
 * Blocks broker phone unmasking until Consent Gate checkbox is confirmed.
 * On consent: captures a Lead row and returns masked routing parameters
 * plus a one-time revealed line for the consented client session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const listingId = String(body.listingId ?? "").trim();
    const requesterId =
      typeof body.requesterId === "string" && body.requesterId.trim()
        ? body.requesterId.trim()
        : null;
    const message =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim().slice(0, 2000)
        : null;
    const consentAccepted = isConsentAccepted(body.consentAccepted);

    if (!listingId) {
      return NextResponse.json(
        {
          error: "ValidationError",
          message: "listingId is required",
          statusCode: 400,
        },
        { status: 400 },
      );
    }

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
    const rawPhone = brokerUser.phone?.trim() ?? null;

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

    if (!consentAccepted) {
      return NextResponse.json(
        {
          error: "ConsentRequired",
          message:
            "Broker telephone indices stay masked until the Consent Gate checkbox is confirmed",
          statusCode: 403,
          consentRequired: true,
          contact: {
            maskedPhone,
            revealedPhone: null,
            brokerDisplayName: brokerUser.fullName,
          },
        },
        { status: 403 },
      );
    }

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
