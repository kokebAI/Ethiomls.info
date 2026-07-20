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
 * Best-effort public Facebook Page scrape.
 * Prefers www.facebook.com HTML (embedded GraphQL/message JSON) because
 * mbasic often redirects to login/cookie walls from datacenter IPs.
 */

const FB_FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9,am;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
} as const;

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

function decodeJsString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    try {
      return raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
    } catch {
      return raw;
    }
  }
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
  for (const match of html.matchAll(
    /"(?:uri|url|src)":"(https:\\\/\\\/[^"]+(?:scontent|fbcdn)[^"]+)"/gi,
  )) {
    try {
      const absolute = match[1].replace(/\\\//g, "/");
      if (/scontent|fbcdn/i.test(absolute)) urls.add(absolute);
    } catch {
      // ignore
    }
  }
  return [...urls].slice(0, 8);
}

/** Pull post bodies from Facebook's embedded page JSON. */
function extractEmbeddedMessages(html: string): string[] {
  const texts: string[] = [];
  const patterns = [
    /"message":\{"text":"(.*?)"(?:,|})/g,
    /"message":\{"__typename":"TextWithEntities","text":"(.*?)"(?:,|})/g,
    /"comet_sections"[\s\S]{0,200}?"message":\{"text":"(.*?)"(?:,|})/g,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const decoded = decodeJsString(match[1] ?? "").trim();
      if (decoded.length >= 40) texts.push(decoded);
    }
  }
  return texts;
}

/**
 * Prefer story/article blocks when mbasic exposes them; else paragraph chunks.
 * Avoid nested `[\s\S]*?` over full Facebook HTML — it can hang the serverless
 * function past `maxDuration` and leave ScrapeRun stuck in RUNNING.
 */
function splitFacebookPosts(html: string, text: string): string[] {
  const fromArticles: string[] = [];
  // Bound scan size; Facebook pages are often multi‑MB of JSON + markup.
  const scan = html.length > 1_500_000 ? html.slice(0, 1_500_000) : html;
  const articleOpen =
    /<(?:article|div)\b[^>]{0,400}(?:role=["']article["']|data-ft=|class=["'][^"']{0,120}story[^"']{0,120}["'])[^>]{0,200}>/gi;
  let openMatch: RegExpExecArray | null;
  let safety = 0;
  while ((openMatch = articleOpen.exec(scan)) !== null && safety < 40) {
    safety += 1;
    const start = openMatch.index + openMatch[0].length;
    const closeTag = scan.slice(start, start + 12_000).search(/<\/(?:article|div)>/i);
    if (closeTag < 0) continue;
    const chunk = stripHtml(scan.slice(start, start + closeTag)).trim();
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

function toWwwUrl(url: string): string {
  const parsed = new URL(url);
  parsed.protocol = "https:";
  parsed.hostname = "www.facebook.com";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function toMbasicUrl(url: string): string {
  const parsed = new URL(url);
  parsed.protocol = "https:";
  parsed.hostname = "mbasic.facebook.com";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function uniqueChunks(chunks: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of chunks) {
    const key = chunk.replace(/\s+/g, " ").trim().toLowerCase();
    if (key.length < 40 || seen.has(key)) continue;
    seen.add(key);
    out.push(chunk.trim());
  }
  return out;
}

function toCandidates(
  chunks: string[],
  sourceUrl: string,
  pageImages: string[],
): ScrapedCandidate[] {
  const candidates: ScrapedCandidate[] = [];
  for (const chunk of chunks) {
    if (!looksLikeListing(chunk)) continue;
    const parsed: ParsedListingDraft = parseListingText(chunk);
    const phones = extractEthiopiaPhones(chunk);
    // Require a phone in the post itself — page-level numbers create greeting/promo noise.
    if (!phones.length) continue;
    candidates.push({
      externalId: contentFingerprint(chunk),
      sourceUrl,
      text: chunk,
      imageUrls: pageImages,
      contactPhones: phones,
      parsed,
    });
  }
  return candidates.slice(0, 20);
}

async function scrapeWwwFacebookPage(url: string): Promise<ScrapedCandidate[]> {
  const wwwUrl = toWwwUrl(url);
  const { html: rawHtml, url: finalUrl } = await fetchPublicText(wwwUrl, {
    headers: FB_FETCH_HEADERS,
  });
  // Cap HTML for regex extraction so admin scrapes finish within function limits.
  const html = rawHtml.length > 2_500_000 ? rawHtml.slice(0, 2_500_000) : rawHtml;

  const messages = uniqueChunks(extractEmbeddedMessages(html));
  const pageImages = extractImages(html, finalUrl);
  const sourceUrl = finalUrl.includes("facebook.com")
    ? finalUrl.replace("mbasic.facebook.com", "www.facebook.com")
    : wwwUrl;

  if (messages.length >= 1) {
    return toCandidates(messages, sourceUrl, pageImages);
  }

  // Fallback: treat paragraph chunks from stripped HTML
  return toCandidates(
    uniqueChunks(splitFacebookPosts(html, stripHtml(html))),
    sourceUrl,
    pageImages,
  );
}

async function scrapeMbasicFacebookPage(
  url: string,
): Promise<ScrapedCandidate[]> {
  const mbasicUrl = toMbasicUrl(url);
  const { html, url: finalUrl } = await fetchPublicText(mbasicUrl, {
    headers: {
      ...FB_FETCH_HEADERS,
      "User-Agent":
        "Mozilla/5.0 (compatible; EthioMLSImportBot/1.0; +https://ethiomls.info)",
    },
  });

  const text = stripHtml(html);
  const pageImages = extractImages(html, finalUrl);
  const sourceUrl = finalUrl.includes("facebook.com")
    ? finalUrl.replace("mbasic.facebook.com", "www.facebook.com")
    : finalUrl;

  return toCandidates(
    uniqueChunks(splitFacebookPosts(html, text)),
    sourceUrl,
    pageImages,
  );
}

export async function scrapeFacebookPage(
  url: string,
): Promise<ScrapedCandidate[]> {
  try {
    const www = await scrapeWwwFacebookPage(url);
    if (www.length > 0) return www;
  } catch {
    // fall through to mbasic
  }

  try {
    return await scrapeMbasicFacebookPage(url);
  } catch {
    return [];
  }
}
