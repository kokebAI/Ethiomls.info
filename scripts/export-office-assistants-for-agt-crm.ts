/**
 * Export EthioMLS OFFICE_ASSISTANT users for AGT CRM agent_assistants.
 *
 *   npx tsx scripts/export-office-assistants-for-agt-crm.ts > /tmp/agt-assistants.json
 *
 * Then on AGT CRM (assign under an agent):
 *   npx tsx scripts/import-assistants-from-json.ts /tmp/agt-assistants.json --agent-id=<uuid>
 */
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

async function main() {
  const users = await prisma.user.findMany({
    where: { role: UserRole.OFFICE_ASSISTANT },
    orderBy: { fullName: "asc" },
    take: 500,
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    count: users.length,
    assistants: users.map((u) => ({
      ethiomlsUserId: u.id,
      fullName: u.fullName,
      phone: u.phone,
      email: u.email,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      canScrapeReview: true,
      canManageLeads: false,
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
