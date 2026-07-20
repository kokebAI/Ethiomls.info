import {
  contentFingerprint,
  extractEthiopiaPhones,
} from "@/lib/imports/extract-contacts";
import { fetchPublicText } from "@/lib/imports/fetch-safe";
import {
  parseIsoOrUnixDate,
  parsePostedAtFromHtml,
  parsePostedAtFromText,
} from "@/lib/imports/parse-source-date";
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

type ApiProperty = {
  id?: number | string;
  title?: string;
  slug?: string;
  description?: string;
  type?: string;
  status?: string;
  price?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  area?: number | string;
  location?: string;
  image?: string | null;
  image_url?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  created_at?: string | number | null;
  updated_at?: string | number | null;
  date?: string | number | null;
  published_at?: string | number | null;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
};

function parseApiPostedAt(property: ApiProperty): Date | null {
  for (const raw of [
    property.created_at,
    property.published_at,
    property.createdAt,
    property.updated_at,
    property.updatedAt,
    property.date,
  ]) {
    const parsed = parseIsoOrUnixDate(raw);
    if (parsed) return parsed;
  }
  return null;
}

function absoluteAsset(origin: string, path: string | null | undefined): string | null {
  if (!path) return null;
  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
}

/** Prefer full purchase price when the listing quotes a down-payment % or ሙሉ ክፍያ. */
function resolveListPrice(rawPrice: number, description: string): number {
  if (!(rawPrice > 0)) return 0;
  const full = description.match(
    /ሙሉ\s*ክፍያ\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)/i,
  );
  if (full) {
    const amount = Number(full[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > rawPrice) return amount;
  }
  const downPct = description.match(/(\d{1,2})\s*%\s*(?:ቅድመ|down)/i);
  if (downPct) {
    const pct = Number(downPct[1]);
    if (pct > 0 && pct < 100 && rawPrice < 5_000_000) {
      return Math.round(rawPrice / (pct / 100));
    }
  }
  return rawPrice;
}

function buildApiListingText(property: ApiProperty, listPrice: number): string {
  const lines = [
    property.title?.trim() || "Property listing",
    property.location ? `Location: ${property.location}` : "",
    property.type ? `For ${property.type}` : "For sale",
    listPrice > 0 ? `Price: ${listPrice} ETB` : "",
    property.bedrooms != null && property.bedrooms !== ""
      ? `${property.bedrooms} bedrooms`
      : "",
    property.bathrooms != null && property.bathrooms !== ""
      ? `${property.bathrooms} bathrooms`
      : "",
    property.area != null && property.area !== ""
      ? `${property.area} m2`
      : "",
    property.phone ? `Contact ${property.phone}` : "",
    property.whatsapp ? `WhatsApp ${property.whatsapp}` : "",
    (property.description || "").trim(),
  ];
  return lines.filter(Boolean).join("\n");
}

async function scrapeJsonPropertyFeed(
  origin: string,
): Promise<ScrapedCandidate[]> {
  const { html } = await fetchPublicText(`${origin}/api/properties.php`);
  let rows: ApiProperty[] = [];
  try {
    const parsed = JSON.parse(html) as unknown;
    if (!Array.isArray(parsed)) return [];
    rows = parsed as ApiProperty[];
  } catch {
    return [];
  }

  let sitePhone = "";
  try {
    const settings = await fetchPublicText(`${origin}/api/settings.php`);
    const cfg = JSON.parse(settings.html) as {
      contact_phone?: string;
      whatsapp_phone?: string;
    };
    sitePhone = cfg.contact_phone || cfg.whatsapp_phone || "";
  } catch {
    // optional
  }

  const seen = new Set<string>();
  const candidates: ScrapedCandidate[] = [];

  for (const property of rows) {
    const rawPrice = Number(property.price) || 0;
    const description = String(property.description || "");
    const listPrice = resolveListPrice(rawPrice, description);
    const text = buildApiListingText(
      {
        ...property,
        phone: property.phone || sitePhone || null,
        whatsapp: property.whatsapp || sitePhone || null,
      },
      listPrice,
    );
    if (!looksLikeListing(text) && !sitePhone) continue;
    if (!looksLikeListing(text) && sitePhone) {
      // Still accept structured API rows with site phone + housing fields.
      const hasHousing =
        Number(property.bedrooms) > 0 ||
        Number(property.area) > 0 ||
        /apartment|mall|shop|villa|ቤት|አፓርት/i.test(text);
      if (!hasHousing) continue;
    }

    const dedupeKey = [
      property.title,
      property.location,
      listPrice,
      property.area,
      property.bedrooms,
    ]
      .map((v) => String(v ?? "").toLowerCase().trim())
      .join("|");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const parsed: ParsedListingDraft = parseListingText(text);
    if (listPrice > 0) {
      parsed.priceAmount = listPrice;
    }
    const phones = extractEthiopiaPhones(text);
    if (sitePhone && !phones.includes(sitePhone.replace(/\s+/g, ""))) {
      phones.push(...extractEthiopiaPhones(sitePhone));
    }
    if (!phones.length) continue;

    const image =
      absoluteAsset(origin, property.image_url) ||
      absoluteAsset(origin, property.image);

    const postedAt =
      parseApiPostedAt(property) || parsePostedAtFromText(text);
    // Post age is mandatory — skip undated API rows.
    if (!postedAt) continue;

    const slug = property.slug || String(property.id ?? contentFingerprint(text));
    candidates.push({
      externalId: `temer-api:${property.id ?? slug}`,
      sourceUrl: `${origin}/property/${encodeURIComponent(String(slug))}`,
      text,
      imageUrls: image ? [image] : [],
      contactPhones: phones,
      parsed,
      postedAt,
    });
  }

  return candidates.slice(0, 40);
}

async function scrapeHtmlWebsite(url: string): Promise<ScrapedCandidate[]> {
  const { html, url: finalUrl } = await fetchPublicText(url);
  const text = stripHtml(html);
  const pageImages = extractImages(html, finalUrl);
  const pagePhones = extractEthiopiaPhones(text);
  const pagePostedAt = parsePostedAtFromHtml(html);
  const candidates: ScrapedCandidate[] = [];

  for (const chunk of splitCandidates(text)) {
    if (!looksLikeListing(chunk)) continue;
    const postedAt = parsePostedAtFromText(chunk) || pagePostedAt;
    // Post age is mandatory — skip undated HTML chunks.
    if (!postedAt) continue;
    const parsed: ParsedListingDraft = parseListingText(chunk);
    const phones = extractEthiopiaPhones(chunk);
    candidates.push({
      externalId: contentFingerprint(chunk),
      sourceUrl: finalUrl,
      text: chunk,
      imageUrls: pageImages,
      contactPhones: phones.length ? phones : pagePhones,
      parsed,
      postedAt,
    });
  }

  return candidates.slice(0, 20);
}

export async function scrapeWebsite(url: string): Promise<ScrapedCandidate[]> {
  const origin = new URL(url).origin;
  try {
    const fromApi = await scrapeJsonPropertyFeed(origin);
    if (fromApi.length > 0) return fromApi;
  } catch {
    // fall through to HTML
  }
  return scrapeHtmlWebsite(url);
}
