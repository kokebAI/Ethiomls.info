/**
 * Seed EthioMLS from AGT CRM using the same route CRM used pre-ECS:
 *   POST {ETHIOMLS_BASE_URL}/api/crm/ingest-listing
 *
 * Pull inventory from CRM admin scrape-properties, then POST each row
 * through EthioMLS ingest (agt-crm-activation) — not direct DB writes.
 *
 * Usage:
 *   npm run scrape:seed-from-crm
 *   npm run scrape:seed-from-crm -- --dry-run
 *   npm run scrape:seed-from-crm -- --limit=20
 *   npm run scrape:seed-from-crm -- --all-sources
 *   npm run scrape:seed-from-crm -- --path=/api/admin/scrape-properties
 *
 * Default path filters CRM to EthioMLS unit listings only
 * (TELEGRAM|FACEBOOK|WEBSITE, needs_listing, not HOA/Places).
 *
 * Env:
 *   AGT_CRM_BASE_URL=https://agtplc.et
 *   AGT_CRM_API_KEY=…          # CRM ADMIN_API_KEY for GET scrape-properties
 *   ETHIOMLS_BASE_URL=https://mls.et
 *   CRM_INGEST_API_KEY=…       # must match EthioMLS ingest auth (or AGT_CRM_API_KEY)
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  fetchAllAgtCrmScrapes,
  isEthiomlsUnitListingScrape,
  postEthiomlsIngestListing,
  type AgtCrmScrapeRow,
} from "../lib/crm/agt-crm-client";

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

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
    // optional
  }
}

type CliOptions = {
  dryRun: boolean;
  limit: number | null;
  path: string | undefined;
  ethiomlsBase: string | undefined;
  /** Include Places/HOA rows (default false — unit listings only). */
  allSources: boolean;
  requireImages: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    limit: null,
    path: undefined,
    ethiomlsBase: undefined,
    allSources: false,
    requireImages: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--all-sources") options.allSources = true;
    else if (arg === "--require-images") options.requireImages = true;
    else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      options.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (arg.startsWith("--path=")) {
      options.path = arg.slice("--path=".length).trim() || undefined;
    } else if (arg.startsWith("--ethiomls-base=")) {
      options.ethiomlsBase =
        arg.slice("--ethiomls-base=".length).trim() || undefined;
    }
  }
  return options;
}

function defaultUnitListingsPath(): string {
  return "/api/admin/scrape-properties?listingOnly=1&invite=any&limit=500";
}

function hasUsableImages(row: AgtCrmScrapeRow): boolean {
  const urls = row.imageUrls;
  return Array.isArray(urls) && urls.some((u) => String(u ?? "").startsWith("http"));
}

function rowLabel(row: AgtCrmScrapeRow): string {
  const id =
    typeof row.crmPropertyId === "string" ? row.crmPropertyId.trim() : "";
  const title = String(row.title ?? "").trim().slice(0, 60);
  return id ? `${id}${title ? ` · ${title}` : ""}` : title || "(untitled)";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const ethiomlsBase = (
    options.ethiomlsBase ||
    process.env.ETHIOMLS_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://mls.et"
  )
    .trim()
    .replace(/\/$/, "");

  const path =
    options.path ||
    (options.allSources
      ? undefined
      : defaultUnitListingsPath());

  console.log("Pulling scrapes from AGT CRM…");
  console.log(`CRM path: ${path ?? "(default scrape-properties)"}`);
  let scrapes = await fetchAllAgtCrmScrapes({ path });
  console.log(`Fetched ${scrapes.length} scrape row(s) from CRM`);

  if (!options.allSources) {
    const before = scrapes.length;
    scrapes = scrapes.filter(isEthiomlsUnitListingScrape);
    console.log(
      `Unit-listing filter: ${before} → ${scrapes.length} (TELEGRAM|FACEBOOK|WEBSITE, needs_listing, not HOA)`,
    );
  }
  if (options.requireImages) {
    const before = scrapes.length;
    scrapes = scrapes.filter(hasUsableImages);
    console.log(`Require images: ${before} → ${scrapes.length}`);
  }

  console.log(`Ingest route: POST ${ethiomlsBase}/api/crm/ingest-listing`);

  if (options.limit != null) {
    scrapes = scrapes.slice(0, options.limit);
    console.log(`Applying --limit=${options.limit} → ${scrapes.length} row(s)`);
  }

  if (scrapes.length === 0) {
    console.log("Nothing to ingest.");
    return;
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of scrapes) {
    const label = rowLabel(row);
    if (options.dryRun) {
      console.log(`[dry-run] would POST ingest-listing ${label}`);
      skipped += 1;
      continue;
    }

    try {
      const result = await postEthiomlsIngestListing(row, {
        baseUrl: ethiomlsBase,
      });
      if (!result.ok) {
        failed += 1;
        console.error(
          `  FAIL ${label}: ${result.error}${result.status ? ` (HTTP ${result.status})` : ""}`,
        );
        continue;
      }
      if (result.action === "created") {
        created += 1;
        console.log(`  + created ${result.listingId} ← ${label}`);
      } else {
        updated += 1;
        console.log(`  ~ updated ${result.listingId} ← ${label}`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAIL ${label}: ${message}`);
    }
  }

  console.log(
    `\nDone. created=${created} updated=${updated} failed=${failed}` +
      (options.dryRun ? ` dryRunSkipped=${skipped}` : ""),
  );

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
