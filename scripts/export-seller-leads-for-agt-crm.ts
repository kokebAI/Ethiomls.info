/**
 * Export EthioMLS seller-role users for AGT CRM crm_accounts.
 *
 *   npx tsx scripts/export-seller-leads-for-agt-crm.ts > /tmp/agt-seller-leads.json
 *
 * Then on AGT CRM:
 *   npx tsx scripts/import-ethiomls-leads-from-json.ts /tmp/agt-seller-leads.json
 */
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import { agtCrmAccountTypeForRole } from "../lib/crm/agt-crm-client";

const SELLER_ROLES = [
  UserRole.PROPERTY_OWNER,
  UserRole.INDEPENDENT_DELALA,
  UserRole.CORPORATE_DEVELOPER,
] as const;

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [...SELLER_ROLES] },
      phone: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: 10_000,
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    count: users.length,
    leads: users.map((u) => ({
      ethiomlsUserId: u.id,
      phoneNumber: u.phone,
      contactPerson: u.fullName,
      companyName: u.fullName,
      email: u.email,
      accountType: agtCrmAccountTypeForRole(u.role),
      source: "signup" as const,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      internalNotes: `Migrated EthioMLS ${u.role}`,
    })),
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
