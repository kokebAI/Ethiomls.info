import { ImportSourceType } from "@prisma/client";

export type NormalizedImportSource = {
  sourceType: ImportSourceType;
  url: string;
  normalizedUrl: string;
  telegramHandle: string | null;
  labelSuggestion: string;
};

/**
 * Accepts admin-entered Telegram handles/URLs or website URLs and returns a
 * canonical form used for uniqueness + scraping.
 */
export function normalizeImportSourceInput(raw: string): NormalizedImportSource {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter a Telegram channel or website URL");
  }

  const handleMatch = trimmed.match(/^@?([A-Za-z0-9_]{4,64})$/);
  if (handleMatch) {
    const handle = handleMatch[1];
    return {
      sourceType: ImportSourceType.TELEGRAM,
      url: `https://t.me/${handle}`,
      normalizedUrl: `https://t.me/s/${handle.toLowerCase()}`,
      telegramHandle: handle,
      labelSuggestion: `@${handle}`,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("URL must be a valid http(s) address or Telegram handle");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "t.me" || host === "telegram.me" || host === "telegram.dog") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const handle = parts[0] === "s" ? parts[1] : parts[0];
    if (!handle || !/^[A-Za-z0-9_]{4,64}$/.test(handle)) {
      throw new Error("Telegram URL must include a public channel handle");
    }
    return {
      sourceType: ImportSourceType.TELEGRAM,
      url: `https://t.me/${handle}`,
      normalizedUrl: `https://t.me/s/${handle.toLowerCase()}`,
      telegramHandle: handle,
      labelSuggestion: `@${handle}`,
    };
  }

  parsed.hash = "";
  parsed.search = "";
  const normalizedUrl = parsed.toString().replace(/\/$/, "");
  return {
    sourceType: ImportSourceType.WEBSITE,
    url: normalizedUrl,
    normalizedUrl,
    telegramHandle: null,
    labelSuggestion: host,
  };
}
