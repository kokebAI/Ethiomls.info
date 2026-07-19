/**
 * Seed one Telegram/website ImportSource and scrape it (all listing types).
 *
 *   npx tsx scripts/scrape-one-source.ts --url=https://t.me/DreamHomeAddis
 *   npx tsx scripts/scrape-one-source.ts --url=@DreamHomeAddis --label="Dream Home Addis"
 *   npx tsx scripts/scrape-one-source.ts --url=https://t.me/DreamHomeAddis --offplan-only
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, UserRole } from "@prisma/client";
import { normalizeImportSourceInput } from "../lib/imports/normalize-source";
import { runImportSource } from "../lib/imports/run-import";

function loadEnvFile(filePath: string) {
  try {
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(path.join(process.cwd(), ".env"));

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  let url = "";
  let label = "";
  let notes = "";
  let offplanOnly = false;
  for (const arg of argv) {
    if (arg.startsWith("--url=")) url = arg.slice("--url=".length).trim();
    else if (arg.startsWith("--label="))
      label = arg.slice("--label=".length).trim();
    else if (arg.startsWith("--notes="))
      notes = arg.slice("--notes=".length).trim();
    else if (arg === "--offplan-only") offplanOnly = true;
  }
  return { url, label, notes, offplanOnly };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.url) {
    throw new Error("Provide --url=https://t.me/Handle or --url=@Handle");
  }

  const admin =
    (process.env.SCRAPE_ADMIN_USER_ID
      ? await prisma.user.findUnique({
          where: { id: process.env.SCRAPE_ADMIN_USER_ID },
          select: { id: true },
        })
      : null) ??
    (await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));
  if (!admin) throw new Error("No ADMIN user found");

  const normalized = normalizeImportSourceInput(opts.url);
  const source = await prisma.importSource.upsert({
    where: { normalizedUrl: normalized.normalizedUrl },
    update: {
      label: opts.label || normalized.labelSuggestion,
      url: normalized.url,
      sourceType: normalized.sourceType,
      telegramHandle: normalized.telegramHandle,
      notes: opts.notes || null,
      isActive: true,
    },
    create: {
      label: opts.label || normalized.labelSuggestion,
      url: normalized.url,
      normalizedUrl: normalized.normalizedUrl,
      sourceType: normalized.sourceType,
      telegramHandle: normalized.telegramHandle,
      notes: opts.notes || null,
      createdById: admin.id,
    },
  });

  console.log(
    `Source ready: ${source.label} (${source.normalizedUrl}) id=${source.id}`,
  );

  const run = await runImportSource({
    sourceId: source.id,
    adminUserId: admin.id,
    filters: opts.offplanOnly ? { corridorOffPlanOnly: true } : undefined,
  });

  console.log(
    JSON.stringify(
      {
        status: run.status,
        postsSeen: run.postsSeen,
        created: run.listingsCreated,
        updated: run.listingsUpdated,
        skipped: run.listingsSkipped,
        summary: run.summary,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
