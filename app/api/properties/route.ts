import { NextRequest, NextResponse } from "next/server";
import { EscrowStatus, ListingStatus, Prisma } from "@prisma/client";
import {
  assertEscrowCompliance,
  evaluateIsUnfinished,
} from "@/lib/compliance/escrow";
import { evaluateForeignerEligibility } from "@/lib/compliance/foreignInvestor";
import { prisma } from "@/lib/db/prisma";
import {
  DataCompletenessError,
  isDataCompletenessError,
} from "@/lib/errors/DataCompletenessError";
import {
  isEscrowComplianceException,
} from "@/lib/errors/EscrowComplianceException";
import { trackDuplicateCollisions } from "@/lib/properties/duplicateCollision";
import { validateCreatePropertyPayload } from "@/lib/properties/validation";

export const runtime = "nodejs";

const DEFAULT_RELEASE_SCHEDULE = {
  EARTHWORKS_FOUNDATION: 10,
  SUBSTRUCTURE: 10,
  SUPERSTRUCTURE: 20,
  ROOFING_ENVELOPE: 15,
  MEP_INSTALLATION: 15,
  INTERIOR_FINISHING: 15,
  EXTERNAL_WORKS: 10,
  FULLY_COMPLETED: 5,
};

function errorResponse(error: unknown) {
  if (isDataCompletenessError(error)) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  if (isEscrowComplianceException(error)) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return NextResponse.json(
        {
          error: "RelatedRecordError",
          message: "Referenced owner or related record does not exist",
          statusCode: 400,
        },
        { status: 400 },
      );
    }
  }

  console.error("[POST /api/properties]", error);
  return NextResponse.json(
    {
      error: "InternalServerError",
      message: "Failed to create property",
      statusCode: 500,
    },
    { status: 500 },
  );
}

/**
 * POST /api/properties
 * Creates a listing after completeness checks, Proc. 1357 escrow enforcement,
 * Proc. 1388 foreigner-eligibility evaluation, and duplicate-collision tracking.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new DataCompletenessError("Request body must be valid JSON", [
        {
          path: "(root)",
          message: "Malformed JSON body",
          code: "invalid_json",
        },
      ]);
    }

    const input = validateCreatePropertyPayload(body);

    const isUnfinished = evaluateIsUnfinished({
      isUnfinished: input.isUnfinished,
      listingType: input.listingType,
      constructionStage: input.constructionStage,
    });

    assertEscrowCompliance({
      isUnfinished,
      listingType: input.listingType,
      constructionStage: input.constructionStage,
      escrowAccountNumber: input.escrowAccountNumber,
      bankEscrowProvider: input.bankEscrowProvider,
      constructionPermitId: input.constructionPermitId,
      constructionPermitVerified: input.constructionPermitVerified,
    });

    const foreignEval = evaluateForeignerEligibility({
      listingType: input.listingType,
      price: input.price,
      currency: input.currency,
    });

    const subCity = await prisma.subCity.findUnique({
      where: { code: input.subCity },
      select: { id: true, code: true, isActive: true },
    });

    if (!subCity || !subCity.isActive) {
      throw new DataCompletenessError(
        "Location must map to a verified Addis Ababa sub-city",
        [
          {
            path: "subCity",
            message: `Sub-city code "${input.subCity}" is not present in verified metadata`,
            code: "unverified_sub_city",
          },
        ],
      );
    }

    const collision = await trackDuplicateCollisions({
      subCityId: subCity.id,
      subCityCode: input.subCity,
      price: input.price,
      bedrooms: input.bedrooms,
      propertyType: input.propertyType,
      incomingOwnerId: input.ownerId,
    });

    const status = collision.collided
      ? ListingStatus.PENDING_REVIEW
      : ListingStatus.DRAFT;

    const listing = await prisma.$transaction(async (tx) => {
      const created = await tx.listing.create({
        data: {
          ownerId: input.ownerId,
          developerId: input.developerId,
          delalaId: input.delalaId,
          projectId: input.projectId,
          subCityId: subCity.id,
          title: input.title,
          description: input.description,
          listingType: input.listingType,
          category: input.propertyType,
          status,
          priceAmount: input.price,
          priceCurrency: input.currency,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          floorAreaSqm: input.sizeM2,
          constructionStage: input.constructionStage,
          metadataTags: input.metadata,
          panoramicImageUrls: input.panoramicImageUrls ?? [],
          galleryImageUrls: input.galleryImageUrls ?? [],
          addressLine: input.addressLine,
          isUnfinished,
          constructionPermitId: input.constructionPermitId,
          constructionPermitVerified: Boolean(input.constructionPermitVerified),
          foreignerEligible: foreignEval.foreignerEligible,
          priceUsdEquivalent: foreignEval.priceUsdEquivalent,
          nbeUsdEtbRateUsed: foreignEval.nbeRate.usdEtb,
          openToForeignBuyers:
            input.openToForeignBuyers ?? foreignEval.foreignerEligible,
        },
        include: {
          subCity: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      if (isUnfinished) {
        await tx.escrowAccount.create({
          data: {
            listingId: created.id,
            status: EscrowStatus.ACTIVE,
            escrowBankName: input.bankEscrowProvider!,
            escrowAccountNumber: input.escrowAccountNumber!,
            authorityApprovalRef: input.constructionPermitId!,
            authorityApprovedAt: new Date(),
            currency: input.currency,
            releaseSchedule: DEFAULT_RELEASE_SCHEDULE,
            notes:
              "Auto-provisioned under Proclamation 1357/2024 unfinished-stock rules",
          },
        });
      }

      return created;
    });

    if (collision.collided && collision.alertId) {
      await prisma.adminAlert.update({
        where: { id: collision.alertId },
        data: {
          listingId: listing.id,
          payload: {
            subCity: input.subCity,
            subCityId: subCity.id,
            price: input.price,
            bedrooms: input.bedrooms,
            propertyType: input.propertyType,
            incomingOwnerId: input.ownerId,
            incomingListingId: listing.id,
            matchedListingIds: collision.flaggedListingIds,
            detectedAt: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json(
      {
        data: {
          id: listing.id,
          status: listing.status,
          subCity: listing.subCity?.code ?? input.subCity,
          price: Number(listing.priceAmount),
          currency: listing.priceCurrency,
          bedrooms: listing.bedrooms,
          propertyType: listing.category,
          listingType: listing.listingType,
          sizeM2: listing.floorAreaSqm
            ? Number(listing.floorAreaSqm)
            : input.sizeM2,
          metadata: listing.metadataTags,
          isUnfinished: listing.isUnfinished,
          constructionPermitId: listing.constructionPermitId,
          foreignerEligible: listing.foreignerEligible,
          priceUsdEquivalent: listing.priceUsdEquivalent
            ? Number(listing.priceUsdEquivalent)
            : foreignEval.priceUsdEquivalent,
          clearanceBadge: foreignEval.clearanceBadgeActive
            ? {
                proclamation: foreignEval.proclamation,
                label: "Proc. 1388/2025 foreign buyer clearance",
                active: true,
              }
            : null,
        },
        compliance: {
          escrowRequired: isUnfinished,
          escrowEnforced: isUnfinished,
          foreignerEligibility: foreignEval,
        },
        collision: {
          detected: collision.collided,
          flaggedListingIds: collision.flaggedListingIds,
          adminAlertId: collision.alertId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
