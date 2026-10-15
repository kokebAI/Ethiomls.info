import { fetchAllAgtCrmScrapes } from "@/lib/crm/agt-crm-client";
import { ingestAgtCrmListing } from "@/lib/crm/ingest-listing";
import { scrapeDestinationIsCrm } from "@/lib/crm/register-ethiomls-listing";

export type CrmCatalogSyncSummary = {
  fetched: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
};

const globalSync = globalThis as {
  __ethiomlsCrmCatalogSync?: Promise<CrmCatalogSyncSummary | null>;
};

function bootSyncEnabled(): boolean {
  const flag = (process.env.CRM_CATALOG_SYNC_ON_BOOT ?? "").trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off" || flag === "no") {
    return false;
  }
  if (flag === "1" || flag === "true" || flag === "on" || flag === "yes") {
    return true;
  }
  return process.env.NODE_ENV === "production" && scrapeDestinationIsCrm();
}

/**
 * Pull AGT CRM scrape rows and upsert them into this database
 * (PENDING_REVIEW + agt-crm-activation). Idempotent on crm property id.
 */
export async function syncAgtCrmScrapesToCatalog(options?: {
  path?: string;
  limit?: number | null;
  maxPages?: number;
}): Promise<CrmCatalogSyncSummary> {
  const summary: CrmCatalogSyncSummary = {
    fetched: 0,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  let scrapes = await fetchAllAgtCrmScrapes({
    path: options?.path,
    maxPages: options?.maxPages,
  });
  if (options?.limit != null && options.limit > 0) {
    scrapes = scrapes.slice(0, options.limit);
  }
  summary.fetched = scrapes.length;

  for (const row of scrapes) {
    try {
      const result = await ingestAgtCrmListing(row);
      if (!result.ok) {
        summary.failed += 1;
        if (summary.errors.length < 8) summary.errors.push(result.error);
        continue;
      }
      if (result.action === "created") summary.created += 1;
      else summary.updated += 1;
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (summary.errors.length < 8) summary.errors.push(message);
    }
  }

  return summary;
}

/**
 * One background pull per Node process when CRM is the scrape destination.
 * Does not block requests. Failures are logged; the public pages stay up.
 */
export function syncCatalogFromCrmOnBoot(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!bootSyncEnabled()) return;
  if (globalSync.__ethiomlsCrmCatalogSync) return;

  globalSync.__ethiomlsCrmCatalogSync = syncAgtCrmScrapesToCatalog({
    maxPages: 20,
  })
    .then((summary) => {
      console.info(
        `[crm→catalog] boot sync fetched=${summary.fetched} created=${summary.created} updated=${summary.updated} failed=${summary.failed}`,
      );
      if (summary.failed > 0) {
        console.error(
          `[crm→catalog] boot sync errors: ${summary.errors.join(" | ")}`,
        );
        if (summary.errors.some((error) => error.includes("No admin owner"))) {
          console.error(
            "[crm→catalog] Create an active user (npx prisma db seed) before CRM rows can be stored.",
          );
        }
      }
      return summary;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[crm→catalog] boot sync failed: ${message}`);
      return null;
    });
}
