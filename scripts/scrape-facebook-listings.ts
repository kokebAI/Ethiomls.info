/**
 * Seed Facebook Page ImportSources and scrape SALE/RENT listings.
 *
 * Usage:
 *   npm run scrape:facebook
 *   npm run scrape:facebook -- --dry-run
 *   npm run scrape:facebook -- --seed-only
 *   npm run scrape:facebook -- --file=data/imports/facebook-sale-rent-sources.json
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, UserRole } from "@prisma/client";
import { normalizeImportSourceInput } from "../lib/imports/normalize-source";
import { runImportSource } from "../lib/imports/run-import";

loadEnvFile(path.join(process.cwd(), ".env"));

const DEFAULT_JSON = path.join(
  process.cwd(),
  "data/imports/facebook-sale-rent-sources.json",
);

const prisma = new PrismaClient();

type SeedSource = {
  label: string;
  url: string;
  track?: string;
  notes?: string;
};

type SeedFile = {
  sources: SeedSource[];
};

type CliOptions = {
  dryRun: boolean;
  seedOnly: boolean;
  file: string;
};

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
    // .env optional when vars are already exported
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    seedOnly: false,
    file: DEFAULT_JSON,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--seed-only") options.seedOnly = true;
    else if (arg.startsWith("--file=")) {
      options.file = path.resolve(process.cwd(), arg.slice("--file=".length));
    }
  }
  return options;
}

async function resolveAdminUserId(): Promise<string> {
  const fromEnv = process.env.SCRAPE_ADMIN_USER_ID?.trim();
  if (fromEnv) {
    const user = await prisma.user.findUnique({
      where: { id: fromEnv },
      select: { id: true },
    });
    if (user) return user.id;
    throw new Error(`SCRAPE_ADMIN_USER_ID=${fromEnv} not found`);
  }

  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!admin) {
    throw new Error(
      "No ADMIN user found. Create an admin or set SCRAPE_ADMIN_USER_ID.",
    );
  }
  return admin.id;
}

async function seedSources(
  seed: SeedFile,
  adminUserId: string,
  dryRun: boolean,
): Promise<{ id: string; label: string; normalizedUrl: string }[]> {
  const upserted: { id: string; label: string; normalizedUrl: string }[] = [];

  for (const entry of seed.sources) {
    const normalized = normalizeImportSourceInput(entry.url);
    const notes =
      entry.notes?.trim() ||
      `facebook-sale-rent${entry.track ? ` · ${entry.track}` : ""}`;

    if (dryRun) {
      console.log(
        `[dry-run] would upsert ${entry.label} → ${normalized.normalizedUrl}`,
      );
      upserted.push({
        id: `dry-${normalized.normalizedUrl}`,
        label: entry.label,
        normalizedUrl: normalized.normalizedUrl,
      });
      continue;
    }

    const source = await prisma.importSource.upsert({
      where: { normalizedUrl: normalized.normalizedUrl },
      update: {
        label: entry.label,
        url: normalized.url,
        sourceType: normalized.sourceType,
        telegramHandle: normalized.telegramHandle,
        notes,
        isActive: true,
      },
      create: {
        label: entry.label,
        url: normalized.url,
        normalizedUrl: normalized.normalizedUrl,
        sourceType: normalized.sourceType,
        telegramHandle: normalized.telegramHandle,
        notes,
        createdById: adminUserId,
      },
      select: { id: true, label: true, normalizedUrl: true },
    });
    console.log(`Seeded ${source.label} (${source.normalizedUrl})`);
    upserted.push(source);
  }

  return upserted;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = readFileSync(options.file, "utf8");
  const seed = JSON.parse(raw) as SeedFile;
  if (!Array.isArray(seed.sources) || seed.sources.length === 0) {
    throw new Error(`No sources in ${options.file}`);
  }

  const adminUserId = await resolveAdminUserId();
  console.log(`Using admin user ${adminUserId}`);

  const sources = await seedSources(seed, adminUserId, options.dryRun);
  console.log(`Sources ready: ${sources.length}`);

  if (options.seedOnly || options.dryRun) {
    if (options.dryRun) {
      console.log("Dry run complete (no scrape).");
    } else {
      console.log("Seed-only complete (no scrape).");
    }
    return;
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const source of sources) {
    console.log(`\nScraping ${source.label}…`);
    try {
      const run = await runImportSource({
        sourceId: source.id,
        adminUserId,
        filters: { saleOrRentOnly: true },
      });
      totalCreated += run.listingsCreated;
      totalUpdated += run.listingsUpdated;
      totalSkipped += run.listingsSkipped;
      console.log(
        `  ${run.status}: seen ${run.postsSeen}, +${run.listingsCreated} / ~${run.listingsUpdated} / skip ${run.listingsSkipped}`,
      );
      const titles = (run.summary as { sampleTitles?: string[] } | null)
        ?.sampleTitles;
      if (titles?.length) {
        for (const title of titles.slice(0, 3)) {
          console.log(`    · ${title.slice(0, 90)}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED: ${message}`);
    }
  }

  console.log(
    `\nDone. Total created ${totalCreated}, updated ${totalUpdated}, skipped ${totalSkipped}.`,
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
