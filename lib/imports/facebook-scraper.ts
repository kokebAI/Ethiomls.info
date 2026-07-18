import {
  contentFingerprint,
  extractEthiopiaPhones,
} from "@/lib/imports/extract-contacts";
import { fetchPublicText } from "@/lib/imports/fetch-safe";
import {
  looksLikeListing,
  parseListingText,
  type ParsedListingDraft,
} from "@/lib/imports/parse-listing-text";
import type { ScrapedCandidate } from "@/lib/imports/telegram-scraper";

/**
 * Best-effort public Facebook Page scrape via mbasic HTML.
 * Private pages, login walls, and heavy JS feeds will yield few/no candidates.
 */

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|article|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractImages(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    try {
      const absolute = new URL(match[1], baseUrl).toString();
      if (
        /\.(jpe?g|png|webp)(\?|$)/i.test(absolute) ||
        /scontent|fbcdn/i.test(absolute)
      ) {
        urls.add(absolute);
      }
    } catch {
      // ignore malformed urls
    }
  }
  return [...urls].slice(0, 8);
}

/** Prefer story/article blocks when mbasic exposes them; else paragraph chunks. */
function splitFacebookPosts(html: string, text: string): string[] {
  const fromArticles: string[] = [];
  for (const match of html.matchAll(
    /<(?:article|div)[^>]*(?:role=["']article["']|data-ft=|class=["'][^"']*story[^"']*["'])[^>]*>([\s\S]*?)<\/(?:article|div)>/gi,
  )) {
    const chunk = stripHtml(match[1] ?? "").trim();
    if (chunk.length >= 60) fromArticles.push(chunk);
  }
  if (fromArticles.length >= 2) return fromArticles.slice(0, 25);

  const chunks = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 60);
  if (chunks.length >= 2) return chunks.slice(0, 25);
  return text.length >= 60 ? [text.slice(0, 5000)] : [];
}

function toMbasicUrl(url: string): string {
  const parsed = new URL(url);
  parsed.protocol = "https:";
  parsed.hostname = "mbasic.facebook.com";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export async function scrapeFacebookPage(url: string): Promise<ScrapedCandidate[]> {
  const mbasicUrl = toMbasicUrl(url);
  const { html, url: finalUrl } = await fetchPublicText(mbasicUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,am;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (compatible; EthioMLSImportBot/1.0; +https://ethiomls.info)",
    },
  });

  const lower = html.toLowerCase();
  if (
    lower.includes("login") &&
    (lower.includes("password") || lower.includes("log in to facebook")) &&
    !looksLikeListing(stripHtml(html).slice(0, 500))
  ) {
    // Soft signal — still try parse; many public pages mix login chrome with posts.
  }

  const text = stripHtml(html);
  const pageImages = extractImages(html, finalUrl);
  const pagePhones = extractEthiopiaPhones(text);
  const candidates: ScrapedCandidate[] = [];

  for (const chunk of splitFacebookPosts(html, text)) {
    if (!looksLikeListing(chunk)) continue;
    const parsed: ParsedListingDraft = parseListingText(chunk);
    const phones = extractEthiopiaPhones(chunk);
    candidates.push({
      externalId: contentFingerprint(chunk),
      sourceUrl: finalUrl.includes("facebook.com")
        ? finalUrl.replace("mbasic.facebook.com", "www.facebook.com")
        : finalUrl,
      text: chunk,
      imageUrls: pageImages,
      contactPhones: phones.length ? phones : pagePhones,
      parsed,
    });
  }

  return candidates.slice(0, 20);
}
