/**
 * Soft-fail client for pushing seller leads into AGT CRM.
 * Unset AGT_CRM_BASE_URL / AGT_CRM_API_KEY → no-op (local scrape/signup still works).
 */

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
  const apiKey = (process.env.AGT_CRM_API_KEY ?? "").trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
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
