/**
 * One-shot ops script:
 * - Mark marketplace listings unverified (clear audit + queue for review)
 * - Ensure admin account for support@agtplc.com (SMS phone +251911000001)
 *
 * Usage: npx tsx scripts/bootstrap-admin-and-unverify.ts
 */
import { ListingStatus, Prisma, UserRole } from "@prisma/client";
import { oauthPlaceholderPasswordHash } from "../lib/auth/oauth";
import { prisma } from "../lib/db/prisma";

const ADMIN_EMAIL = "support@agtplc.com";
const ADMIN_PHONE = "+251911000001";
const ADMIN_NAME = "AGT Support Admin";

async function main() {
  const unverified = await prisma.listing.updateMany({
    where: {
      status: {
        in: [
          ListingStatus.PUBLISHED,
          ListingStatus.PENDING_REVIEW,
          ListingStatus.UNDER_OFFER,
        ],
      },
    },
    data: {
      adminAuditApprovedAt: null,
      adminAuditedById: null,
      adminAuditNotes: null,
      adminAuditChecklist: Prisma.DbNull,
      status: ListingStatus.PENDING_REVIEW,
      publishedAt: null,
    },
  });
  const byEmail = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, phone: true, role: true },
  });
  const byPhone = await prisma.user.findUnique({
    where: { phone: ADMIN_PHONE },
    select: { id: true, email: true, role: true },
  });

  let adminId: string;

  if (byEmail && byPhone && byEmail.id !== byPhone.id) {
    // Prefer the phone demo account; move email onto it and demote the other.
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { email: null },
    });
    const updated = await prisma.user.update({
      where: { id: byPhone.id },
      data: {
        email: ADMIN_EMAIL,
        fullName: ADMIN_NAME,
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: { id: true },
    });
    adminId = updated.id;
  } else if (byPhone) {
    const updated = await prisma.user.update({
      where: { id: byPhone.id },
      data: {
        email: ADMIN_EMAIL,
        fullName: ADMIN_NAME,
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: { id: true },
    });
    adminId = updated.id;
  } else if (byEmail) {
    const updated = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        phone: ADMIN_PHONE,
        fullName: ADMIN_NAME,
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: { id: true },
    });
    adminId = updated.id;
  } else {
    const created = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        fullName: ADMIN_NAME,
        role: UserRole.ADMIN,
        isActive: true,
        passwordHash: oauthPlaceholderPasswordHash(ADMIN_PHONE),
        localePrefs: ["en", "am"],
      },
      select: { id: true },
    });
    adminId = created.id;
  }

  const pending = await prisma.listing.count({
    where: { status: ListingStatus.PENDING_REVIEW },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        listingsQueuedForReview: unverified.count,
        pendingReviewTotal: pending,
        admin: {
          id: adminId,
          email: ADMIN_EMAIL,
          phone: ADMIN_PHONE,
          loginHint: "SMS OTP with 0911000001 (email is profile contact only)",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
