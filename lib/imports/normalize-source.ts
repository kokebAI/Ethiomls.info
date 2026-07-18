import { ImportSourceType } from "@prisma/client";

export type NormalizedImportSource = {
  sourceType: ImportSourceType;
  url: string;
  normalizedUrl: string;
  telegramHandle: string | null;
  labelSuggestion: string;
};

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "mbasic.facebook.com",
  "fb.com",
  "www.fb.com",
  "fb.me",
]);

const FACEBOOK_RESERVED = new Set([
  "watch",
  "reel",
  "reels",
  "marketplace",
  "groups",
  "events",
  "gaming",
  "stories",
  "photo",
  "photos",
  "video",
  "videos",
  "permalink.php",
  "story.php",
  "share",
  "sharer",
  "login",
  "dialog",
  "help",
  "privacy",
  "policies",
  "settings",
  "people",
  "hashtag",
]);

function normalizeFacebookPage(parsed: URL): NormalizedImportSource {
  const parts = parsed.pathname.split("/").filter(Boolean);
  let pageKey = "";

  if (parts[0] === "profile.php") {
    const id = parsed.searchParams.get("id");
    if (!id || !/^\d+$/.test(id)) {
      throw new Error("Facebook profile URL must include a numeric id");
    }
    pageKey = `profile.php?id=${id}`;
  } else if (parts[0] === "pages" && parts.length >= 2) {
    // /pages/Name/123456 or /pages/category/Name/123456
    const maybeId = parts[parts.length - 1];
    pageKey = /^\d+$/.test(maybeId) ? maybeId : parts[1];
  } else if (parts[0] && !FACEBOOK_RESERVED.has(parts[0].toLowerCase())) {
    pageKey = parts[0];
  }

  if (!pageKey) {
    throw new Error(
      "Facebook URL must be a public Page (e.g. facebook.com/YourPage)",
    );
  }

  const displayPath = pageKey.startsWith("profile.php")
    ? `/${pageKey}`
    : `/${pageKey}`;

  return {
    sourceType: ImportSourceType.FACEBOOK,
    url: `https://www.facebook.com${displayPath}`,
    // mbasic is the scrape target — simpler HTML for public posts when available
    normalizedUrl: `https://mbasic.facebook.com${displayPath}`,
    telegramHandle: null,
    labelSuggestion: pageKey.startsWith("profile.php")
      ? `Facebook ${parsed.searchParams.get("id")}`
      : pageKey,
  };
}

/**
 * Accepts admin-entered Telegram handles/URLs, Facebook Page URLs, or website
 * URLs and returns a canonical form used for uniqueness + scraping.
 */
export function normalizeImportSourceInput(raw: string): NormalizedImportSource {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter a Telegram, Facebook, or website URL");
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
    throw new Error(
      "URL must be a valid http(s) address, Telegram handle, or Facebook Page",
    );
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

  const hostFull = parsed.hostname.toLowerCase();
  if (FACEBOOK_HOSTS.has(hostFull) || FACEBOOK_HOSTS.has(host)) {
    return normalizeFacebookPage(parsed);
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
