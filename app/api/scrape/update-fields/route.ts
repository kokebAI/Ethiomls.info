import { ListingType, NotificationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentOpsStaff } from "@/lib/auth/admin";
import { normalizeEthiopiaPhone } from "@/lib/auth/otp";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type Body = {
  listingId?: string;
  contactPhone?: string | null;
  contactName?: string | null;
  titleEn?: string | null;
  titleAm?: string | null;
  priceAmount?: number | string | null;
  priceCurrency?: string | null;
  addressLine?: string | null;
  bedrooms?: number | string | null;
  listingType?: string | null;
  sourcePostedAt?: string | null;
};

/**
 * PATCH /api/scrape/update-fields
 * Admin-only: fill missing scrape fields (phone, price, titles, etc.) from review UI.
 */
export async function PATCH(request: NextRequest) {
  const admin = await getCurrentOpsStaff();
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "InvalidJson", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const listingId = (body.listingId ?? "").trim();
  if (!listingId) {
    return NextResponse.json(
      { error: "BadRequest", message: "listingId is required" },
      { status: 400 },
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      description: true,
      notificationStatus: true,
    },
  });
  if (!listing) {
    return NextResponse.json(
      { error: "NotFound", message: "Listing not found" },
      { status: 404 },
    );
  }
  if (listing.notificationStatus === NotificationStatus.DISCARDED) {
    return NextResponse.json(
      { error: "Discarded", message: "Listing was discarded" },
      { status: 409 },
    );
  }

  const data: Record<string, unknown> = {};

  if (body.contactPhone !== undefined) {
    const raw = body.contactPhone?.trim() || "";
    if (!raw) {
      data.contactPhone = null;
    } else {
      const normalized = normalizeEthiopiaPhone(raw);
      if (!normalized) {
        return NextResponse.json(
          {
            error: "ValidationError",
            message: "Enter a valid Ethiopian phone (09… / 07… / +251…)",
          },
          { status: 400 },
        );
      }
      data.contactPhone = normalized;
    }
  }

  if (body.contactName !== undefined) {
    data.contactName = body.contactName?.trim() || null;
  }

  if (body.titleEn !== undefined || body.titleAm !== undefined) {
    const titleEn =
      body.titleEn !== undefined
        ? body.titleEn?.trim() || ""
        : typeof (listing.title as Record<string, unknown>)?.en === "string"
          ? String((listing.title as Record<string, string>).en)
          : "";
    const titleAm =
      body.titleAm !== undefined
        ? body.titleAm?.trim() || ""
        : typeof (listing.title as Record<string, unknown>)?.am === "string"
          ? String((listing.title as Record<string, string>).am)
          : "";
    if (body.titleEn !== undefined) data.titleEn = titleEn || null;
    if (body.titleAm !== undefined) data.titleAm = titleAm || null;
    data.title = {
      en: titleEn || titleAm || listingId,
      am: titleAm || titleEn || listingId,
      om: titleEn || titleAm || listingId,
      ti: titleEn || titleAm || listingId,
    };
  }

  if (body.priceAmount !== undefined) {
    const amount = Number(body.priceAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { error: "ValidationError", message: "Price must be a non-negative number" },
        { status: 400 },
      );
    }
    data.priceAmount = amount > 0 ? amount : 1;
  }

  if (body.priceCurrency !== undefined) {
    const currency = (body.priceCurrency ?? "ETB").trim().toUpperCase();
    if (currency !== "ETB" && currency !== "USD") {
      return NextResponse.json(
        { error: "ValidationError", message: "Currency must be ETB or USD" },
        { status: 400 },
      );
    }
    data.priceCurrency = currency;
  }

  if (body.addressLine !== undefined) {
    data.addressLine = body.addressLine?.trim() || null;
  }

  if (body.bedrooms !== undefined) {
    if (body.bedrooms === null || body.bedrooms === "") {
      data.bedrooms = null;
    } else {
      const beds = Number(body.bedrooms);
      if (!Number.isInteger(beds) || beds < 0) {
        return NextResponse.json(
          { error: "ValidationError", message: "Bedrooms must be a whole number" },
          { status: 400 },
        );
      }
      data.bedrooms = beds;
    }
  }

  if (body.listingType !== undefined && body.listingType !== null) {
    const type = body.listingType.trim().toUpperCase();
    if (
      type !== ListingType.SALE &&
      type !== ListingType.RENT &&
      type !== ListingType.OFF_PLAN
    ) {
      return NextResponse.json(
        { error: "ValidationError", message: "Invalid listing type" },
        { status: 400 },
      );
    }
    data.listingType = type;
  }

  if (body.sourcePostedAt !== undefined) {
    if (!body.sourcePostedAt?.trim()) {
      data.sourcePostedAt = null;
    } else {
      const date = new Date(body.sourcePostedAt);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "ValidationError", message: "Invalid posted date" },
          { status: 400 },
        );
      }
      data.sourcePostedAt = date;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "ValidationError", message: "No fields to update" },
      { status: 400 },
    );
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data,
    select: {
      id: true,
      contactPhone: true,
      contactName: true,
      titleEn: true,
      titleAm: true,
      priceAmount: true,
      priceCurrency: true,
      addressLine: true,
      bedrooms: true,
      listingType: true,
      sourcePostedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: {
      ...updated,
      priceAmount: updated.priceAmount.toString(),
      sourcePostedAt: updated.sourcePostedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      postedAt:
        updated.sourcePostedAt?.toISOString() ??
        updated.createdAt.toISOString(),
      postedAtIsEstimated: !updated.sourcePostedAt,
    },
  });
}
