/**
 * Drop Facebook chrome / junk CDN assets so scrape covers stay usable.
 */

const MAX_IMAGES = 12;

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Obvious non-listing Facebook / CDN chrome. */
function isJunkListingImageUrl(raw: string): boolean {
  const url = raw.toLowerCase();
  if (/\.gif(\?|$)/i.test(url)) return true;
  if (url.includes("rsrc.php")) return true;
  if (url.includes("emoji.php")) return true;
  if (url.includes("/images/emoji")) return true;
  if (url.includes("static.xx.fbcdn.net")) return true;
  if (url.includes("z-p3-static.xx.fbcdn.net")) return true;
  if (url.includes("static.facebook.com")) return true;
  if (/\/v\/t39\.30808-6\//i.test(url) && url.includes("/p128x128/")) return true;
  if (/scontent[^/]*\/v\/t1\.30497/i.test(url)) return true;
  if (url.includes("/safe_image.php")) return true;
  if (url.includes("external.xx.fbcdn.net")) return true;
  return false;
}

function rankListingImageUrl(raw: string): number {
  const url = raw.toLowerCase();
  if (/scontent/i.test(url) && /\.(jpe?g|png|webp)/i.test(url)) return 0;
  if (/scontent/i.test(url)) return 1;
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) return 2;
  if (/fbcdn/i.test(url)) return 5;
  return 3;
}

/**
 * Keep usable https listing photos; drop FB chrome GIFs and similar junk.
 */
export function sanitizeListingImageUrls(
  urls: unknown,
  limit = MAX_IMAGES,
): string[] {
  if (!Array.isArray(urls)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const entry of urls) {
    const raw = String(entry ?? "")
      .trim()
      .replace(/\\\//g, "/");
    if (!raw || !isHttpUrl(raw) || isJunkListingImageUrl(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    cleaned.push(raw);
  }

  cleaned.sort((a, b) => rankListingImageUrl(a) - rankListingImageUrl(b));
  return cleaned.slice(0, Math.max(1, limit));
}
