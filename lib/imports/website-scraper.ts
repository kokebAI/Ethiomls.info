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

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractImages(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    try {
      const absolute = new URL(match[1], baseUrl).toString();
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(absolute)) urls.add(absolute);
    } catch {
      // ignore malformed urls
    }
  }
  return [...urls].slice(0, 8);
}

function splitCandidates(text: string): string[] {
  const chunks = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 60);
  if (chunks.length >= 2) return chunks.slice(0, 25);
  return text.length >= 60 ? [text.slice(0, 5000)] : [];
}

export async function scrapeWebsite(url: string): Promise<ScrapedCandidate[]> {
  const { html, url: finalUrl } = await fetchPublicText(url);
  const text = stripHtml(html);
  const pageImages = extractImages(html, finalUrl);
  const pagePhones = extractEthiopiaPhones(text);
  const candidates: ScrapedCandidate[] = [];

  for (const chunk of splitCandidates(text)) {
    if (!looksLikeListing(chunk)) continue;
    const parsed: ParsedListingDraft = parseListingText(chunk);
    const phones = extractEthiopiaPhones(chunk);
    candidates.push({
      externalId: contentFingerprint(chunk),
      sourceUrl: finalUrl,
      text: chunk,
      imageUrls: pageImages,
      contactPhones: phones.length ? phones : pagePhones,
      parsed,
    });
  }

  return candidates.slice(0, 20);
}
