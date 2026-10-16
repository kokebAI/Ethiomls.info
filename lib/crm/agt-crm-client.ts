/**
 * Soft-fail client for AGT CRM (lead/assistant push + scrape pull).
 * Unset AGT_CRM_BASE_URL / AGT_CRM_API_KEY → push no-ops; pull throws.
 */

import type { AgtCrmListingIngestInput } from "@/lib/crm/ingest-listing";

/**
 * Default CRM path for scrape inventory (ECS AGT CRM admin API).
 * Auth: AGT_CRM_API_KEY as Bearer / x-admin-api-key / x-crm-api-key
 * (production uses ADMIN_API_KEY on https://agtplc.et).
 */
export const AGT_CRM_SCRAPES_DEFAULT_PATH = "/api/admin/scrape-properties";

export type AgtCrmScrapeRow = AgtCrmListingIngestInput;

export type FetchAgtCrmScrapesPage = {
  scrapes: AgtCrmScrapeRow[];
  /** Opaque cursor for the next page (CRM-defined). */
  nextCursor?: string | null;
  /** 1-based page hint when CRM uses page numbers. */
  nextPage?: number | null;
  hasMore?: boolean;
};

export type FetchAgtCrmScrapesOptions = {
  /** Absolute or path override; defaults to AGT_CRM_SCRAPES_PATH or scrape-properties. */
  path?: string;
  cursor?: string | null;
  page?: number | null;
  signal?: AbortSignal;
};

/** Map AGT CRM scrape-properties row (snake_case) → ingest-listing body. */
export function mapCrmPropertyToIngestRow(
  raw: Record<string, unknown>,
): AgtCrmScrapeRow {
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (raw[key] != null && raw[key] !== "") return raw[key];
    }
    return undefined;
  };

  const imageUrls = normalizeCrmImageUrls(
    pick("imageUrls", "image_urls"),
  );

  const row: AgtCrmScrapeRow = {
    crmPropertyId: pick("crmPropertyId", "id"),
    title: pick("title"),
    description: pick("description", "scraped_raw_text", "scrapedRawText"),
    scrapedRawText: pick("scrapedRawText", "scraped_raw_text"),
    contactPhone: pick("contactPhone", "contact_phone"),
    contactName: pick("contactName", "contact_name"),
    listingType: pick("listingType", "listing_type"),
    category: pick("category"),
    priceAmount: pick("priceAmount", "price_amount"),
    priceCurrency: pick("priceCurrency", "price_currency"),
    bedrooms: pick("bedrooms"),
    bathrooms: pick("bathrooms"),
    floorAreaSqm: pick("floorAreaSqm", "floor_area_sqm"),
    addressLine: pick("addressLine", "address_line"),
    subCityCode: pick("subCityCode", "subcity_code", "sub_city_code"),
    imageUrls,
    sourceUrl: pick("sourceUrl", "source_url"),
    sourcePostedAt: pick("sourcePostedAt", "source_posted_at", "created_at"),
    // Filter hints (not written by ingest-listing; used by seed script).
    needsListing: pick("needsListing", "needs_listing"),
    needsHoa: pick("needsHoa", "needs_hoa"),
    sourceType: pick("sourceType", "source_type"),
  };

  return Object.fromEntries(
    Object.entries(row).filter(([, v]) => v !== undefined),
  ) as AgtCrmScrapeRow;
}

const UNIT_SOURCE_TYPES = new Set(["TELEGRAM", "FACEBOOK", "WEBSITE"]);

/** Absolute-ize CRM-relative photo proxies; drop Places-only paths for MLS. */
export function normalizeCrmImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const crmBase = (
    process.env.AGT_CRM_BASE_URL ?? "https://agtplc.et"
  )
    .trim()
    .replace(/\/$/, "");
  const out: string[] = [];
  for (const entry of raw) {
    let url = String(entry ?? "").trim().replace(/\\\//g, "/");
    if (!url) continue;
    if (url.startsWith("/api/scrape/places-photo")) {
      // Places photos belong to HOA/building inventory — skip for EthioMLS units.
      continue;
    }
    if (url.startsWith("/") && crmBase) {
      url = `${crmBase}${url}`;
    }
    if (!/^https?:\/\//i.test(url)) continue;
    out.push(url);
  }
  return out;
}

/**
 * Keep SALE/RENT/OFF_PLAN unit posts from Telegram/Facebook/website.
 * Drops Places / HOA / Kokeb building-only inventory.
 */
export function isEthiomlsUnitListingScrape(row: AgtCrmScrapeRow): boolean {
  const needsHoa = Boolean(row.needsHoa);
  const needsListing = row.needsListing == null ? true : Boolean(row.needsListing);
  if (needsHoa && !needsListing) return false;
  if (needsListing === false) return false;

  const sourceType = String(row.sourceType ?? "")
    .trim()
    .toUpperCase();
  if (sourceType && !UNIT_SOURCE_TYPES.has(sourceType)) return false;

  // Guard: Places photo proxies or maps URLs are not unit listings.
  const sourceUrl = String(row.sourceUrl ?? "").toLowerCase();
  if (
    sourceUrl.includes("google.com/maps") ||
    sourceUrl.includes("maps.google") ||
    sourceUrl.includes("places.googleapis")
  ) {
    return false;
  }

  return true;
}

export type AgtCrmLeadSource =
  | "scrape_invite"
  | "signup"
  | "listing_create"
  | "sales_kit";

export type RegisterAgtCrmLeadInput = {
  phoneNumber: string;
  companyName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  subcity?: string | null;
  ethiomlsUserId?: string | null;
  ethiomlsListingId?: string | null;
  source: AgtCrmLeadSource;
  accountType?: string | null;
  listingUrl?: string | null;
  sourceUrl?: string | null;
  internalNotes?: string | null;
};

export type RegisterAgtCrmLeadResult =
  | { ok: true; skipped: true; reason: "not_configured" | "no_phone" }
  | {
      ok: true;
      skipped: false;
      action: string;
      ethiomlsLeadKey?: string;
    }
  | { ok: false; skipped: false; error: string };

function crmConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = (process.env.AGT_CRM_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey =
    process.env.CRM_APP_API_KEY?.trim() ||
    process.env.AGT_CRM_API_KEY?.trim() ||
    "";
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

function scrapesListPath(override?: string): string {
  const raw =
    override?.trim() ||
    process.env.AGT_CRM_SCRAPES_PATH?.trim() ||
    AGT_CRM_SCRAPES_DEFAULT_PATH;
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function parseScrapesPayload(payload: unknown): FetchAgtCrmScrapesPage {
  if (Array.isArray(payload)) {
    const scrapes = payload
      .filter(
        (row): row is Record<string, unknown> =>
          row != null && typeof row === "object" && !Array.isArray(row),
      )
      .map(mapCrmPropertyToIngestRow);
    return { scrapes, hasMore: false };
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("AGT CRM scrapes response is not JSON object/array");
  }

  const obj = payload as Record<string, unknown>;
  const list =
    obj.properties ?? obj.scrapes ?? obj.items ?? obj.data ?? obj.listings;
  if (!Array.isArray(list)) {
    throw new Error(
      "AGT CRM scrapes response missing properties/scrapes/items/data array",
    );
  }

  const scrapes = list
    .filter(
      (row): row is Record<string, unknown> =>
        row != null && typeof row === "object" && !Array.isArray(row),
    )
    .map(mapCrmPropertyToIngestRow);

  const nextCursor =
    typeof obj.nextCursor === "string"
      ? obj.nextCursor
      : obj.cursor != null
        ? String(obj.cursor)
        : null;
  const nextPage =
    typeof obj.nextPage === "number"
      ? obj.nextPage
      : typeof obj.page === "number" && obj.hasMore
        ? obj.page + 1
        : null;
  const hasMore =
    typeof obj.hasMore === "boolean"
      ? obj.hasMore
      : Boolean(nextCursor) || Boolean(nextPage);

  return { scrapes, nextCursor, nextPage, hasMore };
}

/**
 * Pull one page of scrape rows from AGT CRM for EthioMLS ingest.
 * Throws when CRM is not configured or the HTTP/JSON response is invalid.
 */
export async function fetchAgtCrmScrapes(
  options: FetchAgtCrmScrapesOptions = {},
): Promise<FetchAgtCrmScrapesPage> {
  const config = crmConfig();
  if (!config) {
    throw new Error(
      "AGT CRM not configured — set AGT_CRM_BASE_URL and AGT_CRM_API_KEY",
    );
  }

  const pathOrUrl = scrapesListPath(options.path);
  const url = new URL(
    /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${config.baseUrl}${pathOrUrl}`,
  );
  if (options.cursor) url.searchParams.set("cursor", options.cursor);
  if (options.page != null && options.page > 0) {
    url.searchParams.set("page", String(options.page));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      // ECS AGT CRM admin scrape-properties accepts ADMIN_API_KEY via these.
      Authorization: `Bearer ${config.apiKey}`,
      "x-admin-api-key": config.apiKey,
      "x-crm-api-key": config.apiKey,
    },
    signal: options.signal ?? AbortSignal.timeout(60_000),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const errObj = payload as { message?: string; error?: string } | null;
    const detail =
      errObj?.message || errObj?.error || `AGT CRM HTTP ${res.status}`;
    throw new Error(`fetchAgtCrmScrapes failed: ${detail}`);
  }

  return parseScrapesPayload(payload);
}

/**
 * POST one scrape/activation into EthioMLS via the canonical CRM route
 * `POST /api/crm/ingest-listing` (same path CRM used before ECS).
 */
export async function postEthiomlsIngestListing(
  body: AgtCrmScrapeRow,
  options?: { baseUrl?: string; apiKey?: string; signal?: AbortSignal },
): Promise<
  | { ok: true; listingId: string; action: "created" | "updated" }
  | { ok: false; error: string; status?: number }
> {
  const baseUrl = (
    options?.baseUrl ||
    process.env.ETHIOMLS_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://mls.et"
  )
    .trim()
    .replace(/\/$/, "");

  const apiKey = (
    options?.apiKey ||
    process.env.CRM_INGEST_API_KEY ||
    process.env.AGT_CRM_API_KEY ||
    ""
  ).trim();

  if (!apiKey) {
    return {
      ok: false,
      error:
        "CRM_INGEST_API_KEY (or AGT_CRM_API_KEY) required to POST /api/crm/ingest-listing",
    };
  }

  const res = await fetch(`${baseUrl}/api/crm/ingest-listing`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-crm-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal ?? AbortSignal.timeout(60_000),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    listingId?: string;
    action?: string;
    error?: string;
    message?: string;
  };

  if (!res.ok || !payload.ok || !payload.listingId) {
    return {
      ok: false,
      status: res.status,
      error:
        payload.error ||
        payload.message ||
        `EthioMLS ingest HTTP ${res.status}`,
    };
  }

  const action = payload.action === "updated" ? "updated" : "created";
  return { ok: true, listingId: payload.listingId, action };
}

/**
 * Pull all scrape pages from AGT CRM (cursor or page pagination).
 */
export async function fetchAllAgtCrmScrapes(options?: {
  path?: string;
  maxPages?: number;
}): Promise<AgtCrmScrapeRow[]> {
  const maxPages = options?.maxPages ?? 100;
  const all: AgtCrmScrapeRow[] = [];
  let cursor: string | null = null;
  let page: number | null = 1;
  let useCursor = false;

  for (let i = 0; i < maxPages; i++) {
    const result = await fetchAgtCrmScrapes({
      path: options?.path,
      cursor: useCursor ? cursor : null,
      page: useCursor ? null : page,
    });
    all.push(...result.scrapes);

    if (result.nextCursor) {
      useCursor = true;
      cursor = result.nextCursor;
      continue;
    }

    if (result.hasMore) {
      page = result.nextPage ?? (page != null ? page + 1 : 2);
      continue;
    }

    break;
  }

  return all;
}

/** Map EthioMLS UserRole / invite role → AGT CRM accountType. */
export function agtCrmAccountTypeForRole(
  role: string | null | undefined,
): string {
  const r = (role ?? "").toUpperCase();
  if (r === "CORPORATE_DEVELOPER" || r.includes("DEVELOPER")) {
    return "developer";
  }
  return "real_estate_agency";
}

/**
 * Map EthioMLS sub-city codes (e.g. "bole") to AGT CRM Addis labels ("Bole").
 */
export function agtCrmSubcityFromCode(
  code: string | null | undefined,
): string | null {
  if (!code?.trim()) return null;
  const key = code.trim().toLowerCase().replace(/[-_\s]+/g, "");
  const map: Record<string, string> = {
    bole: "Bole",
    lemikura: "Lemi Kura",
    yeka: "Yeka",
    kirkos: "Kirkos",
    lideta: "Lideta",
    nifassilklafto: "Nifas Silk-Lafto",
    kolfekeranio: "Kolfe Keranio",
    arada: "Arada",
    gullele: "Gullele",
    addisketema: "Addis Ketema",
    akakykaliti: "Akaky Kaliti",
  };
  if (map[key]) return map[key];
  // Already a display name?
  for (const label of Object.values(map)) {
    if (label.toLowerCase().replace(/[\s-]+/g, "") === key) return label;
  }
  return null;
}

export type RegisterAgtCrmAssistantInput = {
  phoneNumber: string;
  fullName?: string | null;
  ethiomlsUserId?: string | null;
  isActive?: boolean;
  canScrapeReview?: boolean;
  canManageLeads?: boolean;
  agentReferralCode?: string | null;
  agentId?: string | null;
};

export type RegisterAgtCrmAssistantResult =
  | { ok: true; skipped: true; reason: "not_configured" | "no_phone" }
  | {
      ok: true;
      skipped: false;
      action: string;
      agentId?: string;
    }
  | { ok: false; skipped: false; error: string };

/**
 * Push (or refresh) an EthioMLS OFFICE_ASSISTANT into AGT CRM agent_assistants.
 * Never throws — logs and returns ok:false on network/API failures.
 */
export async function registerAgtCrmAssistant(
  input: RegisterAgtCrmAssistantInput,
): Promise<RegisterAgtCrmAssistantResult> {
  const phone = input.phoneNumber?.trim();
  if (!phone) {
    return { ok: true, skipped: true, reason: "no_phone" };
  }

  const config = crmConfig();
  if (!config) {
    return { ok: true, skipped: true, reason: "not_configured" };
  }

  try {
    const res = await fetch(
      `${config.baseUrl}/api/crm/register-ethiomls-assistant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-crm-api-key": config.apiKey,
        },
        body: JSON.stringify({
          phoneNumber: phone,
          fullName: input.fullName ?? null,
          ethiomlsUserId: input.ethiomlsUserId ?? null,
          isActive: input.isActive ?? true,
          canScrapeReview: input.canScrapeReview ?? true,
          canManageLeads: input.canManageLeads ?? false,
          agentReferralCode: input.agentReferralCode ?? null,
          agentId: input.agentId ?? null,
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );

    const payload = (await res.json().catch(() => ({}))) as {
      action?: string;
      agentId?: string;
      message?: string;
      error?: string;
    };

    if (!res.ok) {
      const error =
        payload.message ||
        payload.error ||
        `AGT CRM HTTP ${res.status}`;
      console.error("[agt-crm] register assistant failed", error);
      return { ok: false, skipped: false, error };
    }

    return {
      ok: true,
      skipped: false,
      action: payload.action ?? "ok",
      agentId: payload.agentId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AGT CRM request failed";
    console.error("[agt-crm] register assistant error", message);
    return { ok: false, skipped: false, error: message };
  }
}

/**
 * Push (or refresh) an EthioMLS seller lead in AGT CRM.
 * Never throws — logs and returns ok:false on network/API failures.
 */
export async function registerAgtCrmLead(
  input: RegisterAgtCrmLeadInput,
): Promise<RegisterAgtCrmLeadResult> {
  const phone = input.phoneNumber?.trim();
  if (!phone) {
    return { ok: true, skipped: true, reason: "no_phone" };
  }

  const config = crmConfig();
  if (!config) {
    return { ok: true, skipped: true, reason: "not_configured" };
  }

  try {
    const res = await fetch(
      `${config.baseUrl}/api/crm/register-ethiomls-lead`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-crm-api-key": config.apiKey,
        },
        body: JSON.stringify({
          phoneNumber: phone,
          companyName: input.companyName ?? null,
          contactPerson: input.contactPerson ?? null,
          email: input.email ?? null,
          subcity: input.subcity ?? null,
          ethiomlsUserId: input.ethiomlsUserId ?? null,
          ethiomlsListingId: input.ethiomlsListingId ?? null,
          source: input.source,
          accountType: input.accountType ?? null,
          listingUrl: input.listingUrl ?? null,
          sourceUrl: input.sourceUrl ?? null,
          internalNotes: input.internalNotes ?? null,
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );

    const payload = (await res.json().catch(() => ({}))) as {
      action?: string;
      ethiomlsLeadKey?: string;
      message?: string;
      error?: string;
    };

    if (!res.ok) {
      const error =
        payload.message ||
        payload.error ||
        `AGT CRM HTTP ${res.status}`;
      console.error("[agt-crm] register lead failed", error);
      return { ok: false, skipped: false, error };
    }

    return {
      ok: true,
      skipped: false,
      action: payload.action ?? "ok",
      ethiomlsLeadKey: payload.ethiomlsLeadKey,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AGT CRM request failed";
    console.error("[agt-crm] register lead error", message);
    return { ok: false, skipped: false, error: message };
  }
}
