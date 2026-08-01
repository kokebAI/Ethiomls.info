/**
 * Export EthioMLS ImportSource rows as JSON for AGT CRM import.
 *
 *   npx tsx scripts/export-import-sources-for-agt-crm.ts > /tmp/agt-import-sources.json
 *
 * Then on AGT CRM:
 *   npx tsx scripts/import-sources-from-json.ts /tmp/agt-import-sources.json
 */
import { prisma } from "../lib/db/prisma";

async function main() {
  const sources = await prisma.importSource.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      label: true,
      sourceType: true,
      url: true,
      normalizedUrl: true,
      telegramHandle: true,
      notes: true,
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    count: sources.length,
    sources: sources.map((s) => ({
      label: s.label,
      sourceType: s.sourceType,
      url: s.url,
      normalizedUrl: s.normalizedUrl,
      telegramHandle: s.telegramHandle,
      notes: s.notes,
      targetApps: ["ethiomls"],
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
