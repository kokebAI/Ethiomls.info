import { smsNotificationEngine } from "@/src/services/sms.service";

export type InviteListingRef = {
  id: string;
};

/** Soft cap for concatenated Unicode SMS via HaHu (multipart). */
const INVITE_SMS_MAX_CHARS = 600;
const MAX_LISTING_URLS_IN_SMS = 2;

function listingPublicUrl(listingId: string): string {
  return smsNotificationEngine.buildAbsoluteUrl(
    `/am/listings/${encodeURIComponent(listingId)}`,
  );
}

function claimLoginUrl(): string {
  return smsNotificationEngine.buildAbsoluteUrl(`/am/login?mode=reset`);
}

function trimToSmsLimit(message: string): string {
  const chars = [...message];
  if (chars.length <= INVITE_SMS_MAX_CHARS) return message;
  return chars.slice(0, INVITE_SMS_MAX_CHARS).join("");
}

function buildSingleListingInviteMessage(listing: InviteListingRef): string {
  const resetUrl = claimLoginUrl();
  const listingUrl = listingPublicUrl(listing.id);

  const amharic =
    `የEthioMLS AI መተግበሪያ ዝርዝርዎን አግኝቶ ትኩረት የሚስብ ሆኖ አግኝቶታል። ` +
    `ዝርዝር፡ ${listingUrl} ` +
    `ተመሳሳይ ስልክ በመጠቀም የይለፍ ቃል ዳግም ያስጀምሩ፡ ${resetUrl} ` +
    `ከዚያ ይግቡና ዝርዝርዎን ያርሙ። ለግምገማ ሲገቡ ጠቃሚ ፍንጮችና መመሪያዎች ይረዱዎታል።`;

  const english =
    `EthioMLS AI found your listing interesting. ` +
    `Listing: ${listingUrl} ` +
    `Use the same phone, then Reset password: ${resetUrl} ` +
    `Sign in and edit your listing. Tooltips and other aids will help once you come in to review.`;

  return trimToSmsLimit(`${amharic}\n\n${english}`);
}

/**
 * Build scrape-invite SMS for one or more listings on the same phone.
 * Full Amharic first, then English.
 */
export function buildScrapeInviteMessageForListings(
  listings: InviteListingRef[],
): string {
  if (listings.length === 0) return "";
  if (listings.length === 1) {
    return buildSingleListingInviteMessage(listings[0]);
  }

  const resetUrl = claimLoginUrl();
  const count = listings.length;
  const urlLines = listings
    .slice(0, MAX_LISTING_URLS_IN_SMS)
    .map((listing) => listingPublicUrl(listing.id))
    .join(" ");
  const moreNoteAm =
    count > MAX_LISTING_URLS_IN_SMS
      ? ` ሁሉንም ${count} ዝርዝሮች ለማየት ይግቡ።`
      : "";
  const moreNoteEn =
    count > MAX_LISTING_URLS_IN_SMS
      ? ` Sign in to review all ${count} listings.`
      : "";

  const amharic =
    `የEthioMLS AI መተግበሪያ ${count} ዝርዝሮችዎን አግኝቶ ትኩረት የሚስብ ሆኖ አግኝቶታል። ` +
    `ዝርዝሮች፡ ${urlLines}${moreNoteAm} ` +
    `ተመሳሳይ ስልክ በመጠቀም የይለፍ ቃል ዳግም ያስጀምሩ፡ ${resetUrl} ` +
    `ከዚያ ይግቡና ዝርዝሮችዎን ያርሙ። ለግምገማ ጠቃሚ ፍንጮች ይረዱዎታል።`;

  const english =
    `EthioMLS AI found ${count} of your listings interesting. ` +
    `Listings: ${urlLines}${moreNoteEn} ` +
    `Use the same phone, then Reset password: ${resetUrl} ` +
    `Sign in and edit. Tooltips and other aids will help once you come in to review.`;

  return trimToSmsLimit(`${amharic}\n\n${english}`);
}

export function buildScrapeInviteMessage(listing: InviteListingRef): string {
  return buildScrapeInviteMessageForListings([listing]);
}
