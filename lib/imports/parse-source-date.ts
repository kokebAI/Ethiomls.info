/**
 * Parse post / published timestamps from scrape HTML, API fields, and free text.
 */

export function parseIsoOrUnixDate(raw: string | number | null | undefined): Date | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    // Unix seconds vs milliseconds
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^\d{9,13}$/.test(trimmed)) {
    return parseIsoOrUnixDate(Number(trimmed));
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Extract first reliable datetime from HTML (Telegram / article / meta). */
export function parsePostedAtFromHtml(html: string): Date | null {
  const patterns = [
    /<time[^>]*datetime=["']([^"']+)["']/i,
    /property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
    /property=["']og:updated_time["'][^>]*content=["']([^"']+)["']/i,
    /itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
    /datetime=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const parsed = parseIsoOrUnixDate(match?.[1]);
    if (parsed) return parsed;
  }
  return null;
}

/** Facebook embedded GraphQL often uses creation_time as unix seconds. */
export function parseFacebookCreationTimes(html: string): Date[] {
  const dates: Date[] = [];
  for (const match of html.matchAll(
    /"creation_time"\s*:\s*(\d{9,13})/g,
  )) {
    const parsed = parseIsoOrUnixDate(match[1]);
    if (parsed) dates.push(parsed);
  }
  for (const match of html.matchAll(
    /"publish_time"\s*:\s*(\d{9,13})/g,
  )) {
    const parsed = parseIsoOrUnixDate(match[1]);
    if (parsed) dates.push(parsed);
  }
  return dates;
}

/**
 * Best-effort date from free-text listing body (e.g. "Posted: 12 Jan 2026").
 */
export function parsePostedAtFromText(text: string): Date | null {
  const patterns = [
    /(?:posted|published|date|የተለጠፈ|ቀን)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?)/i,
    /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\b/,
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = parseIsoOrUnixDate(match?.[1]);
    if (parsed) return parsed;
  }
  return null;
}
