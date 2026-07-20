import {
  ListingType,
} from "@prisma/client";
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

type HtmlScrapeResult = {
  candidates: ScrapedCandidate[];
  isSpaShell: boolean;
};

async function scrapeHtmlWebsite(url: string): Promise<HtmlScrapeResult> {
  const { html, url: finalUrl } = await fetchPublicText(url);
  const text = stripHtml(html);
  const isSpaShell =
    /id=["']root["']/i.test(html) &&
    text.length < 200 &&
    /<script[^>]+type=["']module["']/i.test(html);
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

  return { candidates: candidates.slice(0, 20), isSpaShell };
}

/** Normalize FHC / org phones (incl. malformed +09… values) to E.164 mobile. */
function normalizeOrgMobilePhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (/^0[79]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^[79]\d{8}$/.test(digits)) return `+251${digits}`;
  if (/^251[79]\d{8}$/.test(digits)) return `+${digits}`;
  // "+0911097668" style → 0911097668 after stripping non-digits already handled above
  return extractEthiopiaPhones(raw)[0] ?? null;
}

function strapiCmsOrigins(pageUrl: string): string[] {
  const page = new URL(pageUrl);
  const bare = page.hostname.replace(/^www\./i, "");
  const protocol = page.protocol === "http:" ? "http:" : "https:";
  return [
    `${protocol}//${page.hostname}:1337`,
    `${protocol}//www.${bare}:1337`,
    `${protocol}//${bare}:1337`,
    page.origin,
  ].filter((value, index, all) => all.indexOf(value) === index);
}

type StrapiProjectRow = {
  id?: number | string;
  documentId?: string;
  title?: string;
  projectStatus?: string | null;
  units?: number | string | null;
  budget?: number | string | null;
  location_name?: string | null;
  location_link?: string | null;
  progress_percentage?: number | string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  featured_image?: { url?: string | null } | null;
  localizations?: Array<{ title?: string; locale?: string | null }>;
};

async function fetchJsonOrNull(url: string): Promise<unknown | null> {
  try {
    const { html } = await fetchPublicText(url, {
      headers: { Accept: "application/json" },
    });
    if (html.trimStart().startsWith("<")) return null;
    return JSON.parse(html) as unknown;
  } catch {
    return null;
  }
}

/**
 * Vite + Strapi sites (e.g. fhc.gov.et) expose projects on host:1337/api/projects.
 * HTML homepage is an empty SPA shell — scrape the CMS JSON instead.
 */
async function scrapeStrapiProjectsFeed(
  pageUrl: string,
): Promise<ScrapedCandidate[]> {
  for (const cmsOrigin of strapiCmsOrigins(pageUrl)) {
    const payload = await fetchJsonOrNull(
      `${cmsOrigin}/api/projects?pagination[pageSize]=100&populate=*`,
    );
    if (!payload || typeof payload !== "object") continue;
    const rows = (payload as { data?: StrapiProjectRow[] }).data;
    if (!Array.isArray(rows) || rows.length === 0) continue;

    let sitePhone = "";
    const settings = await fetchJsonOrNull(
      `${cmsOrigin}/api/site-setting?populate=*`,
    );
    if (settings && typeof settings === "object") {
      const data = (settings as { data?: { phone?: string | null } }).data;
      sitePhone = normalizeOrgMobilePhone(data?.phone) ?? "";
    }
    if (!sitePhone) {
      // Last resort: known FHC HQ mobile from public site-setting dump.
      const host = new URL(pageUrl).hostname.toLowerCase();
      if (host.includes("fhc.gov.et")) {
        sitePhone = "+251911097668";
      }
    }

    const pageOrigin = new URL(pageUrl).origin;
    const candidates: ScrapedCandidate[] = [];

    for (const project of rows) {
      const title =
        project.title?.trim() ||
        project.localizations?.find((row) => row.locale?.startsWith("am"))
          ?.title?.trim() ||
        "Housing project";
      const amTitle =
        project.localizations?.find((row) => row.locale?.startsWith("am"))
          ?.title?.trim() || "";
      const location = project.location_name?.trim() || "";
      const status = project.projectStatus?.trim() || "";
      const units = project.units != null && project.units !== ""
        ? String(project.units)
        : "";
      const budgetRaw = Number(project.budget);
      const budget =
        Number.isFinite(budgetRaw) && budgetRaw > 0 ? budgetRaw : 0;
      const progress =
        project.progress_percentage != null && project.progress_percentage !== ""
          ? `${project.progress_percentage}% complete`
          : "";

      const text = [
        title,
        amTitle && amTitle !== title ? amTitle : "",
        "Federal Housing Corporation (FHC) project",
        "Off-plan / housing project",
        location ? `Location: ${location}` : "Location: Addis Ababa",
        status ? `Status: ${status}` : "",
        units ? `Units: ${units}` : "",
        progress,
        budget > 0 ? `Budget: ${budget} ETB` : "Price on request",
        sitePhone ? `Contact ${sitePhone}` : "",
        project.location_link ? `Map: ${project.location_link}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const postedAt =
        parseIsoOrUnixDate(project.publishedAt) ||
        parseIsoOrUnixDate(project.createdAt) ||
        parseIsoOrUnixDate(project.updatedAt);
      if (!postedAt) continue;

      const phones = sitePhone
        ? [sitePhone]
        : extractEthiopiaPhones(text);
      if (!phones.length) continue;

      const parsed: ParsedListingDraft = parseListingText(text);
      parsed.listingType = ListingType.OFF_PLAN;
      parsed.title = title.slice(0, 120);
      if (budget > 0) parsed.priceAmount = budget;
      if (location) parsed.addressLine = location;

      const imagePath = project.featured_image?.url;
      const image = absoluteAsset(cmsOrigin, imagePath);
      const externalId = String(
        project.documentId || project.id || contentFingerprint(text),
      );

      candidates.push({
        externalId: `strapi-project:${externalId}`,
        sourceUrl: `${pageOrigin}/projects`,
        text,
        imageUrls: image ? [image] : [],
        contactPhones: phones,
        parsed,
        postedAt,
      });
    }

    if (candidates.length > 0) return candidates.slice(0, 40);
  }

  return [];
}

export async function scrapeWebsite(url: string): Promise<ScrapedCandidate[]> {
  const origin = new URL(url).origin;
  try {
    const fromApi = await scrapeJsonPropertyFeed(origin);
    if (fromApi.length > 0) return fromApi;
  } catch {
    // fall through
  }

  try {
    const fromStrapi = await scrapeStrapiProjectsFeed(url);
    if (fromStrapi.length > 0) return fromStrapi;
  } catch {
    // fall through to HTML
  }

  const htmlResult = await scrapeHtmlWebsite(url);
  if (htmlResult.candidates.length > 0) return htmlResult.candidates;

  const host = new URL(url).hostname;
  if (htmlResult.isSpaShell) {
    throw new Error(
      `No listings found — ${host} is a JavaScript app shell with no HTML listings. EthioMLS tried the public CMS API (including :1337/api/projects) and found nothing usable. Use a public Telegram channel, Facebook Page, or paste listing text instead.`,
    );
  }
  throw new Error(
    `No dated property listings found on ${host}. The page must include public listing text with a post date, or expose a JSON property feed.`,
  );
}
