import { NextRequest, NextResponse } from "next/server";
import {
  EscrowStatus,
  ListingEvidenceKind,
  ListingStatus,
  ListingType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { ensureBilingualListingCopy } from "@/lib/ai/translate-listing";
import {
  assertEscrowCompliance,
  evaluateIsUnfinished,
} from "@/lib/compliance/escrow";
import { evaluateForeignerEligibility } from "@/lib/compliance/foreignInvestor";
import { getLiveNbeUsdEtbRate } from "@/lib/compliance/nbeRate";
import { allocateUniquePropertyId } from "@/lib/db/allocatePropertyId";
import { prisma } from "@/lib/db/prisma";
import {
  DataCompletenessError,
  isDataCompletenessError,
} from "@/lib/errors/DataCompletenessError";
import {
  isEscrowComplianceException,
} from "@/lib/errors/EscrowComplianceException";
import { getSession } from "@/lib/auth/session";
import { trackDuplicateCollisions } from "@/lib/properties/duplicateCollision";
import {
  EVIDENCE_KIND_LABELS,
  isLiveFaydaConfigured,
  MIN_GALLERY_PHOTOS,
  missingEvidenceKinds,
  requiresDeveloperFullPack,
} from "@/lib/properties/evidence";
import {
  assertListingCreateAllowed,
  canCreateListings,
} from "@/lib/properties/listing-roles";
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
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(", ")
        : String(error.meta?.target ?? "id");
      return NextResponse.json(
        {
          error: "PropertyIdCollision",
          message:
            target === "id" || target.includes("id")
              ? "That property ID was just taken. Tap Submit again — a new ID will be used."
              : `A unique field already exists (${target}). Adjust the listing and retry.`,
          statusCode: 409,
          target,
        },
        { status: 409 },
      );
    }

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

function isListingIdCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (target == null) return true;
  if (Array.isArray(target)) return target.includes("id");
  return String(target).includes("id");
}

async function resolveListingId(preferredId: string): Promise<string> {
  const existing = await prisma.listing.findUnique({
    where: { id: preferredId },
    select: { id: true },
  });
  if (!existing) return preferredId;
  return allocateUniquePropertyId(prisma);
}

/**
 * POST /api/properties
 * Creates a listing after completeness checks, Proc. 1357 escrow enforcement,
 * Proc. 1388 foreigner-eligibility evaluation, and duplicate-collision tracking.
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

    const user = await prisma.user.findFirst({
      where: { id: session.userId, isActive: true },
      select: {
        id: true,
        role: true,
        fullName: true,
        developerProfile: {
          select: { id: true, tin: true, registrationNumber: true },
        },
        delalaProfile: {
          select: { id: true },
        },
        faydaIdentity: { select: { id: true } },
      },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Account not found", statusCode: 401 },
        { status: 401 },
      );
    }

    if (!canCreateListings(user.role)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Clients cannot publish listings — browse and enquire only",
          statusCode: 403,
        },
        { status: 403 },
      );
    }

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

    const input = validateCreatePropertyPayload({
      ...(body as object),
      ownerId: user.id,
    });

    try {
      assertListingCreateAllowed({
        role: user.role,
        listingType: input.listingType,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Listing type not allowed for your role";
      return NextResponse.json(
        { error: "Forbidden", message, statusCode: 403 },
        { status: 403 },
      );
    }

    let developerId = input.developerId ?? user.developerProfile?.id ?? null;
    let delalaId =
      input.delalaId ??
      (user.role === UserRole.INDEPENDENT_DELALA
        ? (user.delalaProfile?.id ?? null)
        : null);
    let profileTin = user.developerProfile?.tin ?? null;
    if (
      user.role === UserRole.CORPORATE_DEVELOPER &&
      !developerId &&
      input.tradeName &&
      input.registrationNumber
    ) {
      const createdProfile = await prisma.developerProfile.create({
        data: {
          userId: user.id,
          tradeName: input.tradeName,
          displayName: { en: input.tradeName },
          registrationNumber: input.registrationNumber,
        },
        select: { id: true, tin: true },
      });
      developerId = createdProfile.id;
      profileTin = createdProfile.tin;
    }

    if (input.projectId && developerId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, developerId },
        select: { id: true },
      });
      if (!project) {
        throw new DataCompletenessError("projectId must belong to your developer profile", [
          {
            path: "projectId",
            message: "Unknown or unauthorized project",
            code: "invalid_project",
          },
        ]);
      }
    }

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

    const fullPack = requiresDeveloperFullPack({
      role: user.role,
      listingType: input.listingType,
    });

    const evidenceIds = input.evidenceUploadIds ?? [];
    const uploads =
      evidenceIds.length > 0
        ? await prisma.evidenceUpload.findMany({
            where: { id: { in: evidenceIds }, userId: user.id },
          })
        : [];

    let galleryImageUrls = [...(input.galleryImageUrls ?? [])];

    if (fullPack) {
      if (uploads.length !== evidenceIds.length) {
        throw new DataCompletenessError("Some evidence uploads are missing or expired", [
          {
            path: "evidenceUploadIds",
            message: "Re-upload required documents",
            code: "evidence_missing",
          },
        ]);
      }

      const docKinds = uploads
        .filter((u) => u.kind !== ListingEvidenceKind.UNIT_GALLERY)
        .map((u) => u.kind);
      const missing = missingEvidenceKinds(docKinds, {
        skipTin: Boolean(profileTin),
        holdType: input.landHoldType ?? "FREEHOLD",
      });
      if (missing.length > 0) {
        throw new DataCompletenessError("Developer off-plan checklist incomplete", [
          {
            path: "evidenceUploadIds",
            message: `Missing: ${missing.map((k) => EVIDENCE_KIND_LABELS[k]).join(", ")}`,
            code: "evidence_checklist_incomplete",
          },
        ]);
      }

      const galleryFromUploads = uploads
        .filter((u) => u.kind === ListingEvidenceKind.UNIT_GALLERY)
        .map((u) => u.publicUrl);
      galleryImageUrls = [
        ...new Set([...galleryImageUrls, ...galleryFromUploads]),
      ].slice(0, 12);
      if (galleryImageUrls.length < MIN_GALLERY_PHOTOS) {
        throw new DataCompletenessError(
          `At least ${MIN_GALLERY_PHOTOS} unit photos are required`,
          [
            {
              path: "galleryImageUrls",
              message: `Upload at least ${MIN_GALLERY_PHOTOS} photos`,
              code: "gallery_insufficient",
            },
          ],
        );
      }

      if (isLiveFaydaConfigured() && !user.faydaIdentity) {
        throw new DataCompletenessError("Fayda eSignet verification required", [
          {
            path: "faydaVerify",
            message: "Complete Fayda verification before submitting off-plan inventory",
            code: "fayda_required",
          },
        ]);
      }
      if (!isLiveFaydaConfigured() && !user.faydaIdentity) {
        throw new DataCompletenessError("Fayda demo verification required", [
          {
            path: "faydaVerify",
            message: "Tap Verify with Fayda (demo) on the checklist",
            code: "fayda_required",
          },
        ]);
      }

      if (!developerId) {
        throw new DataCompletenessError(
          "Developer profile required — provide trade name and registration number",
          [
            {
              path: "tradeName",
              message: "tradeName and registrationNumber are required once",
              code: "developer_profile_required",
            },
          ],
        );
      }
    }

    const liveNbeRate = await getLiveNbeUsdEtbRate();
    const foreignEval = evaluateForeignerEligibility(
      {
        listingType: input.listingType,
        price: input.price,
        currency: input.currency,
      },
      liveNbeRate,
    );

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
      incomingOwnerId: user.id,
    });

    // Every submission enters the admin audit queue. No seller, importer, or
    // collision-free payload can self-publish or bypass client-protection review.
    const status = ListingStatus.PENDING_REVIEW;

    // Auto-translate English ↔ Amharic listing copy before persist.
    const bilingual = await ensureBilingualListingCopy({
      title: input.title,
      description: input.description,
    });

    const galleryImageUrlsFinal = galleryImageUrls;
    const coverImageUrl = galleryImageUrlsFinal[0] ?? null;

    let listingId = await resolveListingId(input.id);
    let listing: {
      id: string;
      status: ListingStatus;
      priceAmount: Prisma.Decimal;
      priceCurrency: string;
      bedrooms: number | null;
      category: string;
      listingType: string;
      floorAreaSqm: Prisma.Decimal | null;
      metadataTags: string[];
      isUnfinished: boolean;
      constructionPermitId: string | null;
      foreignerEligible: boolean;
      priceUsdEquivalent: Prisma.Decimal | null;
      subCity: { id: string; code: string; name: unknown } | null;
    } | null = null;
    let lastError: unknown;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        listing = await prisma.$transaction(async (tx) => {
          const created = await tx.listing.create({
            data: {
              id: listingId,
              ownerId: user.id,
              developerId: developerId ?? null,
              delalaId: delalaId ?? null,
              projectId: input.projectId,
              subCityId: subCity.id,
              title: bilingual.title,
              description: bilingual.description,
              titleEn: bilingual.titleEn || null,
              titleAm: bilingual.titleAm || null,
              descriptionEn: bilingual.descriptionEn || null,
              descriptionAm: bilingual.descriptionAm || null,
              listingType: input.listingType,
              category: input.propertyType,
              status,
              priceAmount: input.price,
              priceCurrency: input.currency,
              bedrooms: input.bedrooms,
              bathrooms: input.bathrooms,
              floorAreaSqm: input.sizeM2,
              constructionStage: input.constructionStage,
              metadataTags: [...input.metadata, `pid:${listingId}`],
              panoramicImageUrls: input.panoramicImageUrls ?? [],
              galleryImageUrls: galleryImageUrlsFinal,
              coverImageUrl,
              images: galleryImageUrlsFinal,
              addressLine: input.addressLine,
              isUnfinished,
              constructionPermitId: input.constructionPermitId,
              constructionPermitVerified: Boolean(
                input.constructionPermitVerified,
              ),
              foreignerEligible: foreignEval.foreignerEligible,
              priceUsdEquivalent: foreignEval.priceUsdEquivalent,
              nbeUsdEtbRateUsed: foreignEval.nbeRate.usdEtb,
              openToForeignBuyers:
                input.openToForeignBuyers ?? foreignEval.foreignerEligible,
              landHoldType: input.landHoldType ?? null,
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

          if (uploads.length > 0) {
            const site =
              process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
              "https://ethiomls.info";
            for (const u of uploads) {
              const row = await tx.listingEvidence.create({
                data: {
                  listingId: created.id,
                  kind: u.kind,
                  fileName: u.fileName,
                  mimeType: u.mimeType,
                  byteSize: u.byteSize,
                  storagePath: u.storagePath,
                  publicUrl: u.publicUrl,
                  contentBytes: u.contentBytes
                    ? new Uint8Array(u.contentBytes)
                    : null,
                },
              });
              if (u.contentBytes && !u.storagePath) {
                await tx.listingEvidence.update({
                  where: { id: row.id },
                  data: {
                    publicUrl: `${site}/api/properties/evidence/${row.id}/file`,
                  },
                });
              }
            }
            await tx.evidenceUpload.deleteMany({
              where: { id: { in: uploads.map((u) => u.id) } },
            });
          }

          return created;
        });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (!isListingIdCollision(error) || attempt === 4) throw error;
        listingId = await allocateUniquePropertyId(prisma);
      }
    }

    if (!listing) throw lastError ?? new Error("Failed to create property");

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
            incomingOwnerId: user.id,
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
          listingType: ListingType.OFF_PLAN,
          fullPack,
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
