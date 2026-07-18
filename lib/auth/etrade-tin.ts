/**
 * Ethiopian TIN helpers + optional live check via etrade.gov.et
 * (Business License Checker: api/Registration/GetRegistrationInfoByTin).
 */

export const ETRADE_LICENSE_CHECKER_URL =
  "https://etrade.gov.et/business-license-checker";

const ETRADE_TIN_API =
  "https://etrade.gov.et/api/Registration/GetRegistrationInfoByTin";
const ETRADE_CONFIG_URL = "https://etrade.gov.et/assets/config.json";

/** Ethiopian TINs are typically 10 digits (leading zeros allowed). */
export function normalizeEthiopiaTin(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").trim();
  if (!/^\d{10}$/.test(digits)) return null;
  return digits;
}

export function isValidEthiopiaTin(raw: string): boolean {
  return normalizeEthiopiaTin(raw) !== null;
}

/** Unique DeveloperProfile.registrationNumber derived from TIN. */
export function registrationNumberFromTin(tin: string): string {
  return `TIN-${tin}`;
}

export type EtradeTinVerification =
  | {
      ok: true;
      tin: string;
      verified: true;
      tradeName?: string;
      businessName?: string;
    }
  | {
      ok: true;
      tin: string;
      /** Format OK but e-Trade was unreachable / under maintenance */
      verified: false;
      deferred: true;
      message: string;
    }
  | { ok: false; tin?: string; message: string };

type RegistrationInfo = {
  Tin?: string;
  TradeName?: string;
  TradeNameEng?: string;
  BusinessName?: string;
  BusinessNameEng?: string;
  [key: string]: unknown;
};

async function etradeUnderMaintenance(): Promise<boolean> {
  try {
    const res = await fetch(ETRADE_CONFIG_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { maintenance?: boolean };
    return Boolean(data.maintenance);
  } catch {
    return false;
  }
}

/**
 * Look up a TIN on etrade.gov.et. Rejects clearly invalid TINs (HTTP 204 / empty).
 * If the portal is in maintenance or unreachable, accepts format-valid TINs as deferred.
 */
export async function verifyTinOnEtrade(
  tinRaw: string,
  lang: "en" | "am" | "om" | "ti" = "en",
): Promise<EtradeTinVerification> {
  const tin = normalizeEthiopiaTin(tinRaw);
  if (!tin) {
    return {
      ok: false,
      message: "Enter a valid 10-digit Ethiopian Tax Identification Number (TIN)",
    };
  }

  if (await etradeUnderMaintenance()) {
    return {
      ok: true,
      tin,
      verified: false,
      deferred: true,
      message:
        "e-Trade is under maintenance — TIN format accepted. Confirm later at etrade.gov.et.",
    };
  }

  const langPath = lang === "am" || lang === "om" || lang === "ti" ? lang : "en";
  const url = `${ETRADE_TIN_API}/${encodeURIComponent(tin)}/${langPath}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: ETRADE_LICENSE_CHECKER_URL,
        Origin: "https://etrade.gov.et",
        "User-Agent":
          "EthioMLS/1.0 (+https://ethiomls.info; developer-signup-tin-check)",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });

    if (res.status === 204 || res.status === 404) {
      return {
        ok: false,
        tin,
        message:
          "That TIN was not found on etrade.gov.et. Check the number or verify on the e-Trade license checker.",
      };
    }

    if (!res.ok) {
      return {
        ok: true,
        tin,
        verified: false,
        deferred: true,
        message: `e-Trade returned HTTP ${res.status} — TIN format accepted; confirm on etrade.gov.et.`,
      };
    }

    const text = (await res.text()).trim();
    if (!text) {
      return {
        ok: false,
        tin,
        message:
          "That TIN was not found on etrade.gov.et. Check the number or verify on the e-Trade license checker.",
      };
    }

    let data: RegistrationInfo;
    try {
      data = JSON.parse(text) as RegistrationInfo;
    } catch {
      return {
        ok: true,
        tin,
        verified: false,
        deferred: true,
        message:
          "Could not parse e-Trade response — TIN format accepted; confirm on etrade.gov.et.",
      };
    }

    const tradeName =
      (typeof data.TradeNameEng === "string" && data.TradeNameEng.trim()) ||
      (typeof data.TradeName === "string" && data.TradeName.trim()) ||
      undefined;
    const businessName =
      (typeof data.BusinessNameEng === "string" && data.BusinessNameEng.trim()) ||
      (typeof data.BusinessName === "string" && data.BusinessName.trim()) ||
      undefined;

    return {
      ok: true,
      tin,
      verified: true,
      tradeName,
      businessName,
    };
  } catch {
    return {
      ok: true,
      tin,
      verified: false,
      deferred: true,
      message:
        "Could not reach etrade.gov.et — TIN format accepted. Confirm later on the license checker.",
    };
  }
}
