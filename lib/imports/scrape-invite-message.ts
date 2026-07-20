import { smsNotificationEngine } from "@/src/services/sms.service";

export type InviteListingRef = {
  id: string;
};

/**
 * Soft upper bound for HaHu multipart Unicode SMS.
 * Cold-onboarding invite is intentionally long (Amharic + English).
 */
const INVITE_SMS_MAX_CHARS = 4_000;

function claimUrlFor(listingId: string): string {
  return smsNotificationEngine.buildAbsoluteUrl(
    `/am/listings/${encodeURIComponent(listingId)}`,
  );
}

function resetUrl(): string {
  return smsNotificationEngine.buildAbsoluteUrl(`/am/login?mode=reset`);
}

function trimToSmsLimit(message: string): string {
  const chars = [...message];
  if (chars.length <= INVITE_SMS_MAX_CHARS) return message;
  return chars.slice(0, INVITE_SMS_MAX_CHARS).join("");
}

/**
 * Definitive HaHu cold-onboarding invite — Amharic first, then English.
 * Tokens: claimUrl (listing), resetUrl (Reset password).
 */
export function buildScrapeInviteMessageForListings(
  listings: InviteListingRef[],
): string {
  if (listings.length === 0) return "";

  const primary = listings[0];
  const claimUrl = claimUrlFor(primary.id);
  const passwordResetUrl = resetUrl();
  const extraCount = listings.length - 1;

  const extraLinksAm =
    extraCount > 0
      ? `\n\nተጨማሪ ${extraCount} ዝርዝር(ዎች)፦\n${listings
          .slice(1, 4)
          .map((listing) => `🔗 ${claimUrlFor(listing.id)}`)
          .join("\n")}${
          listings.length > 4
            ? `\n(ሁሉንም ${listings.length} ዝርዝሮች ለማየት ይግቡ።)`
            : ""
        }`
      : "";

  const extraLinksEn =
    extraCount > 0
      ? `\n\nAdditional listing(s) (${extraCount}):\n${listings
          .slice(1, 4)
          .map((listing) => `🔗 ${claimUrlFor(listing.id)}`)
          .join("\n")}${
          listings.length > 4
            ? `\n(Sign in to review all ${listings.length} listings.)`
            : ""
        }`
      : "";

  const amharic = `ሰላም 👋 አዲስ እና አስደሳች ዜና ለእርስዎ!

በቅርቡ በየሶሻል ሚዲያው ያወጡትን የቤት ማስታወቂያ በኢትዮጵያ የመጀመሪያው በሆነው በEthioMLS AI (አርቴፊሻል ኢንተለጀንስ) መተግበሪያ ላይ አይተነዋል። የእርስዎን ስራ ይበልጥ ለማቃለል እና ብዙ ደንበኛ ለማግኘት እንዲረዳዎት፣ የእኛ AI ማስታወቂያዎን በነፃ ሙሉ በሙሉ ወደ ዘመናዊ የዲጂታል መገለጫ ቀይሮታል።

የተዘጋጀው ዝርዝርዎ ይኸውልዎት፦
🔗 ሊንክ፦ ${claimUrl}${extraLinksAm}

ይህ ለእርስዎ ምን ጥቅም አለው?
• Bilingual (በ2 ቋንቋ)፦ ማስታወቂያዎ በአማርኛ እና በእንግሊዝኛ ተዘጋጅቶ በሀገር ውስጥና በውጭ ሀገር (Diaspora) ላሉ ከፍተኛ ገዢዎች በግልፅ ይታያል።
• ቁጥጥር በእርስዎ እጅ፦ የእርስዎ ስልክ ቁጥር አስቀድሞ በደህንነት መለያነት ተመዝግቧል። መለያዎን ለመረከብ፣ ፎቶዎችን ለመጨመር እና ዋጋ ለማስተካከል የሚከተሉትን ቀላል ደረጃዎች ይከተሉ፦
1️⃣ መጀመሪያ የይለፍ ቃልዎን እዚህ ያስተካክሉ፦ ${passwordResetUrl}
2️⃣ በመቀጠል በመግባት የፈለጉትን መረጃ ያርሙ።

መድረካችን አዲስ እንደመሆኑ መጠን በውስጡ ያሉት መመሪያዎች እና ፍንጮች (Tooltips) ስራዎን እጅግ በጣም ያቀልሉልዎታል። አብረውን ስላደጉ እናመሰግናለን! 🚀`;

  const english = `Hello 👋 Exciting news for your real estate business!

We recently spotted your real estate post and our active EthioMLS AI system has automatically transformed your raw text into a premium, comprehensive digital listing profile on our brand-new platform—completely free of charge.

Your Live Generated Profile:
🔗 Listing Link: ${claimUrl}${extraLinksEn}

Why activate your EthioMLS account today?
• Bilingual AI Processing: Your property is instantly optimized and translated into both English and Amharic, giving you direct exposure to local buyers and the high-value diaspora investment market.
• Complete Control: Your phone number is already securely mapped as the owner. To claim ownership, add high-res interior photos, and manage inquiries:
1️⃣ First, securely set up your new account password here: ${passwordResetUrl}
2️⃣ Sign in to unlock your dynamic dashboard and edit your details.

Since EthioMLS is a new, specialized ecosystem designed to help you sell faster, our step-by-step tooltips and smart dashboard aids will guide you through maximizing your reach the moment you log in! 🚀`;

  return trimToSmsLimit(`${amharic}\n\n${english}`);
}

export function buildScrapeInviteMessage(listing: InviteListingRef): string {
  return buildScrapeInviteMessageForListings([listing]);
}
