/**
 * EthioMLS recent-projects importer.
 *
 * Default source: curated JSON at data/projects/addis-projects.json
 * Upserts Project by buildProjectId; Listings by buildPropertyId.
 * Links DeveloperProfile by registrationNumber; ownerId = developer.userId.
 *
 * Usage:
 *   npm run scrape:projects
 *   npm run scrape:projects -- --dry-run
 *   npm run scrape:projects -- --file=data/projects/addis-projects.json
 *   npm run scrape:projects -- --limit=3
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ConstructionStage,
  CurrencyCode,
  ListingStatus,
  ListingType,
  PrismaClient,
  PropertyCategory,
} from "@prisma/client";
import { allocateUniquePropertyId } from "../lib/db/allocatePropertyId";
import { amenityFlagsFromTags } from "../lib/properties/amenities";
import {
  buildListingSourceKey,
  buildProjectId,
} from "../lib/properties/propertyId";

loadEnvFile(path.join(process.cwd(), ".env"));

const DEFAULT_JSON = path.join(
  process.cwd(),
  "data/projects/addis-projects.json",
);

type Localized = { en: string; am: string; om?: string; ti?: string };

type CuratedUnit = {
  unitLabel: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  floorAreaSqm: number;
  price: number;
  currency: "ETB" | "USD";
  listingType: "SALE" | "RENT" | "OFF_PLAN";
  status: "available" | "reserved" | "sold";
  title: Localized;
  description: Localized;
  amenities?: string[];
  category?: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | "LAND";
};

type CuratedFloor = {
  level: number;
  label?: Localized;
  units: CuratedUnit[];
};

type CuratedProject = {
  slug: string;
  registrationNumber: string;
  subCityCode: string;
  title: Localized;
  description: Localized;
  addressLine?: string | null;
  constructionStage: string;
  completionPercent: number;
  requiresEscrow?: boolean;
  website?: string | null;
  telegram?: string | null;
  sourceUpdatedAt: string;
  amenities?: string[];
  category?: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | "LAND";
  building: { floors: CuratedFloor[] };
};

type CuratedFile = {
  source?: string;
  projects: CuratedProject[];
};

type CliOptions = {
  dryRun: boolean;
  file: string;
  delayMs: number;
  limit: number | null;
};

const prisma = new PrismaClient();

const STAGES = new Set<string>(Object.values(ConstructionStage));

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
  const opts: CliOptions = {
    dryRun: false,
    file: DEFAULT_JSON,
    delayMs: 100,
    limit: null,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--file=")) {
      opts.file = path.resolve(process.cwd(), arg.slice("--file=".length));
    } else if (arg.startsWith("--delay-ms=")) {
      opts.delayMs = Math.max(0, Number(arg.slice("--delay-ms=".length)) || 0);
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      opts.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
EthioMLS projects scraper / importer

  --dry-run              Print actions without writing to the database
  --file=<path>          Curated JSON path (default: data/projects/addis-projects.json)
  --delay-ms=<n>         Pause between project upserts (default: 100)
  --limit=<n>            Cap number of projects processed
  --help                 Show this help
`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseStage(raw: string): ConstructionStage {
  if (STAGES.has(raw)) return raw as ConstructionStage;
  throw new Error(`Invalid constructionStage: ${raw}`);
}

function parseListingType(raw: string): ListingType {
  if (raw === "SALE" || raw === "RENT" || raw === "OFF_PLAN") return raw;
  throw new Error(`Invalid listingType: ${raw}`);
}

function parseCurrency(raw: string): CurrencyCode {
  if (raw === "ETB" || raw === "USD") return raw;
  throw new Error(`Invalid currency: ${raw}`);
}

function parseCategory(
  raw: string | undefined,
): PropertyCategory {
  if (!raw) return PropertyCategory.RESIDENTIAL;
  if (
    raw === "RESIDENTIAL" ||
    raw === "COMMERCIAL" ||
    raw === "MIXED_USE" ||
    raw === "LAND"
  ) {
    return raw;
  }
  throw new Error(`Invalid category: ${raw}`);
}

async function loadCurated(filePath: string): Promise<CuratedProject[]> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as CuratedFile;
  if (!Array.isArray(parsed.projects)) {
    throw new Error(`Invalid curated file: missing projects[] in ${filePath}`);
  }
  return parsed.projects;
}

type UpsertStats = {
  projectsCreated: number;
  projectsUpdated: number;
  listingsUpserted: number;
  dryRunWouldUpsert: number;
};

async function upsertProject(
  rec: CuratedProject,
  opts: CliOptions,
  subCityByCode: Map<string, string>,
  developerByReg: Map<
    string,
    { id: string; userId: string; tradeName: string }
  >,
  stats: UpsertStats,
): Promise<void> {
  const developer = developerByReg.get(rec.registrationNumber);
  if (!developer) {
    throw new Error(
      `No DeveloperProfile for registrationNumber ${rec.registrationNumber}`,
    );
  }

  const subCityId = subCityByCode.get(rec.subCityCode);
  if (!subCityId) {
    throw new Error(`Unknown subCityCode "${rec.subCityCode}"`);
  }

  const projectId = buildProjectId({
    subCityCode: rec.subCityCode,
    developerRegistration: rec.registrationNumber,
    developerTradeName: developer.tradeName,
    slug: rec.slug,
  });

  const stage = parseStage(rec.constructionStage);
  const walkthrough = {
    telegram: rec.telegram ?? null,
    website: rec.website ?? null,
    sourceUpdatedAt: rec.sourceUpdatedAt,
    amenities: rec.amenities ?? [],
  };

  const units = rec.building.floors.flatMap((f) =>
    f.units.map((unit) => ({ ...unit, floor: unit.floor ?? f.level })),
  );

  if (opts.dryRun) {
    console.log(
      `  [dry-run] project ${projectId} — ${rec.title.en} (${units.length} units)`,
    );
    for (const unit of units) {
      const sourceKey = buildListingSourceKey({
        projectId,
        floor: unit.floor,
        unitLabel: unit.unitLabel,
      });
      console.log(
        `    [dry-run] listing source=${sourceKey} · F${unit.floor} ${unit.unitLabel} · ${unit.status}`,
      );
    }
    stats.dryRunWouldUpsert += 1 + units.length;
    return;
  }

  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  await prisma.project.upsert({
    where: { id: projectId },
    update: {
      developerId: developer.id,
      subCityId,
      title: rec.title,
      description: rec.description,
      addressLine: rec.addressLine ?? null,
      constructionStage: stage,
      completionPercent: rec.completionPercent,
      requiresEscrow: rec.requiresEscrow ?? true,
      // Imported inventory is never trusted automatically. An admin must
      // complete the audit checklist before activation/publication.
      status: ListingStatus.PENDING_REVIEW,
      virtualWalkthroughConfig: walkthrough,
    },
    create: {
      id: projectId,
      developerId: developer.id,
      subCityId,
      title: rec.title,
      description: rec.description,
      addressLine: rec.addressLine ?? null,
      constructionStage: stage,
      completionPercent: rec.completionPercent,
      requiresEscrow: rec.requiresEscrow ?? true,
      status: ListingStatus.PENDING_REVIEW,
      virtualWalkthroughConfig: walkthrough,
    },
  });

  if (existing) stats.projectsUpdated += 1;
  else stats.projectsCreated += 1;

  const publishedAt = new Date(
    Number.isNaN(Date.parse(rec.sourceUpdatedAt))
      ? Date.now()
      : rec.sourceUpdatedAt,
  );

  for (const unit of units) {
    const listingType = parseListingType(unit.listingType);
    const currency = parseCurrency(unit.currency);
    const category = parseCategory(unit.category ?? rec.category);
    const sourceKey = buildListingSourceKey({
      projectId,
      floor: unit.floor,
      unitLabel: unit.unitLabel,
    });

    const existingListing = await prisma.listing.findFirst({
      where: {
        projectId,
        metadataTags: { has: sourceKey },
      },
      select: { id: true },
    });
    const listingId =
      existingListing?.id ?? (await allocateUniquePropertyId(prisma));

    const metadataTags = [
      sourceKey,
      `floor:${unit.floor}`,
      `unit:${unit.unitLabel}`,
      `pid:${listingId}`,
      `status:${unit.status}`,
      `category:${category.toLowerCase()}`,
      ...(unit.amenities ?? []).map((a) => `amenity:${a}`),
    ];

    const unitConfig = {
      telegram: rec.telegram ?? null,
      website: rec.website ?? null,
      sourceUpdatedAt: rec.sourceUpdatedAt,
      amenities: unit.amenities ?? [],
      inventoryStatus: unit.status,
      floor: unit.floor,
      unitLabel: unit.unitLabel,
    };

    const amenityFlags = amenityFlagsFromTags([
      ...(unit.amenities ?? []),
      ...(rec.amenities ?? []),
    ]);

    const listingData = {
      ownerId: developer.userId,
      developerId: developer.id,
      projectId,
      subCityId,
      title: unit.title,
      description: unit.description,
      listingType,
      category,
      status: ListingStatus.PENDING_REVIEW,
      priceAmount: unit.price,
      priceCurrency: currency,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      floorAreaSqm: unit.floorAreaSqm,
      addressLine: rec.addressLine ?? null,
      constructionStage: stage,
      completionPercent: rec.completionPercent,
      isUnfinished: listingType === ListingType.OFF_PLAN,
      metadataTags,
      virtualWalkthroughConfig: unitConfig,
      ...amenityFlags,
      publishedAt: null,
      lastRefreshDate: publishedAt,
    };

    if (existingListing) {
      await prisma.listing.update({
        where: { id: listingId },
        data: listingData,
      });
    } else {
      await prisma.listing.create({
        data: { id: listingId, ...listingData },
      });
    }
    stats.listingsUpserted += 1;
  }

  console.log(
    `  ✓ ${projectId} — ${rec.title.en} (${units.length} listings)`,
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("EthioMLS projects scrape/import");
  console.log(
    JSON.stringify(
      {
        dryRun: opts.dryRun,
        file: opts.file,
        delayMs: opts.delayMs,
        limit: opts.limit,
      },
      null,
      2,
    ),
  );

  let projects = await loadCurated(opts.file);
  console.log(`Loaded ${projects.length} curated projects from ${opts.file}`);
  if (opts.limit != null) projects = projects.slice(0, opts.limit);

  const subCities = await prisma.subCity.findMany({
    select: { id: true, code: true },
  });
  const subCityByCode = new Map(subCities.map((s) => [s.code, s.id]));

  const developers = await prisma.developerProfile.findMany({
    select: { id: true, userId: true, registrationNumber: true, tradeName: true },
  });
  const developerByReg = new Map(
    developers.map((d) => [
      d.registrationNumber,
      { id: d.id, userId: d.userId, tradeName: d.tradeName },
    ]),
  );

  if (subCities.length === 0 && !opts.dryRun) {
    console.warn(
      "Warning: no SubCity rows found. Run `npm run db:seed` so codes can map.",
    );
  }
  if (developers.length === 0 && !opts.dryRun) {
    console.warn(
      "Warning: no DeveloperProfile rows. Run `npm run scrape:developers` first.",
    );
  }

  const stats: UpsertStats = {
    projectsCreated: 0,
    projectsUpdated: 0,
    listingsUpserted: 0,
    dryRunWouldUpsert: 0,
  };
  let failed = 0;

  for (const rec of projects) {
    try {
      await upsertProject(rec, opts, subCityByCode, developerByReg, stats);
    } catch (err) {
      failed += 1;
      console.error(
        `  ✗ ${rec.slug} (${rec.registrationNumber}):`,
        err instanceof Error ? err.message : err,
      );
    }
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }

  const totals = opts.dryRun
    ? null
    : {
        projects: await prisma.project.count({
          where: { id: { startsWith: "ETMLS-PRJ-" } },
        }),
        listings: await prisma.listing.count({
          where: { id: { startsWith: "ETMLS-" }, NOT: { id: { startsWith: "ETMLS-PRJ-" } } },
        }),
      };

  console.log("\nSummary");
  console.log(
    JSON.stringify(
      {
        processed: projects.length,
        ...stats,
        failed,
        etmlsProjectsInDb: totals?.projects ?? null,
        etmlsListingsInDb: totals?.listings ?? null,
      },
      null,
      2,
    ),
  );

  if (opts.dryRun) {
    console.log(
      "\nDry-run only — re-run without --dry-run to write to the database.",
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
