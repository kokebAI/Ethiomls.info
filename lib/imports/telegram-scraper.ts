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

export type ScrapedCandidate = {
  externalId: string;
  sourceUrl: string;
  text: string;
  imageUrls: string[];
  contactPhones: string[];
  parsed: ParsedListingDraft;
};

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractBackgroundImages(block: string): string[] {
  const urls = new Set<string>();
  for (const match of block.matchAll(
    /background-image:\s*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/gi,
  )) {
    urls.add(match[1]);
  }
  for (const match of block.matchAll(/src=["'](https?:\/\/[^"']+)["']/gi)) {
    if (/\.(jpe?g|png|webp)/i.test(match[1])) urls.add(match[1]);
  }
  return [...urls].slice(0, 8);
}

export async function scrapeTelegramChannel(
  previewUrl: string,
  handle: string,
): Promise<ScrapedCandidate[]> {
  const { html } = await fetchPublicText(previewUrl);
  if (
    !html.includes("tgme_widget_message") &&
    html.includes("tgme_page_description")
  ) {
    throw new Error(
      `@${handle} is not a public channel preview. Use a public channel URL (t.me/s/...) or switch to a website source.`,
    );
  }

  const blocks = html.split('class="tgme_widget_message_wrap').slice(1);
  const candidates: ScrapedCandidate[] = [];

  for (const block of blocks) {
    const postMatch = block.match(/data-post="([^"]+)"/i);
    const textMatch = block.match(
      /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i,
    );
    const rawText = textMatch ? decodeHtml(textMatch[1]) : "";
    if (!rawText || !looksLikeListing(rawText)) continue;

    const externalId =
      postMatch?.[1]?.split("/").pop() ?? contentFingerprint(rawText);
    const sourceUrl = postMatch
      ? `https://t.me/${postMatch[1]}`
      : `https://t.me/${handle}`;
    const imageUrls = extractBackgroundImages(block);
    const contactPhones = extractEthiopiaPhones(rawText);
    const parsed = parseListingText(rawText);

    candidates.push({
      externalId: String(externalId),
      sourceUrl,
      text: rawText,
      imageUrls,
      contactPhones,
      parsed,
    });
  }

  return candidates;
}
