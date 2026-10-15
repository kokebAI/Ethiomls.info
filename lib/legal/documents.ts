import { SITE_OPERATOR } from "@/lib/legal/operator";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

const operator = SITE_OPERATOR.legalName;
const trade = SITE_OPERATOR.tradeName;

/**
 * English clause text. Other locales show this same text under a
 * "pending translation" notice until the owner supplies a translation.
 * The wording is a template for counsel to review, not a finished policy.
 */
export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "operator",
    title: "Who operates mls.et",
    paragraphs: [
      `${operator}, trade name ${trade}, operates the EthioMLS website at mls.et (the "service"). References to "we" and "the operator" mean that company.`,
      "The registry details published on the About page (TIN, business license, trade-name registration, address, and telephone) identify the operator. They are not a substitute for a government certificate.",
    ],
  },
  {
    id: "use",
    title: "Using the service",
    paragraphs: [
      "You may browse public listing teasers without an account. Signing in, publishing a listing, or requesting a contact unlocks a fuller record and means you agree to these terms.",
      "The service lists homes and commercial space, mainly in Addis Ababa. A listing is an invitation to enquire. It is not an offer that forms a sale, lease, or escrow by itself.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts",
    paragraphs: [
      "You must give a reachable phone number or email and keep your sign-in details to yourself. You are responsible for activity under your account.",
      "We may refuse, suspend, or close an account that is inactive, misleading, or used in a way these terms do not allow. Staff roles are issued by the operator, not by self-signup.",
    ],
  },
  {
    id: "listings",
    title: "Listings",
    paragraphs: [
      "If you submit a listing, you confirm you have authority to advertise that property and that the price, location, photos, and contact details are not knowingly false.",
      "Publication is not automatic. The operator may hold a listing for review, label it unverified, reject it, or take it down. Verification badges, escrow notes, and foreign-buyer labels describe checks the operator has recorded. They are not a government title search and they are not a warranty of ownership.",
    ],
  },
  {
    id: "enquiries",
    title: "Enquiries",
    paragraphs: [
      "Requesting a broker or owner contact creates a lead. You should only do that if you agree to share that enquiry with the listing side and with the operator.",
      "Telephone numbers stay masked until that step. Do not scrape, republish, or reuse contact details you unlock.",
    ],
  },
  {
    id: "conduct",
    title: "Acceptable use",
    paragraphs: [
      "Do not break into accounts, probe non-public APIs, send bulk unsolicited messages, upload malware, or post content that infringes someone else's rights.",
      "Do not present an unverified or scraped listing as if the operator has confirmed title, permit, or price.",
    ],
  },
  {
    id: "liability",
    title: "Liability",
    paragraphs: [
      "The service is provided as available. Listings can be wrong, outdated, or withdrawn. You should verify title, permit, price, and identity yourself, or through your own adviser, before you pay anyone.",
      "To the extent Ethiopian law allows, the operator is not liable for indirect or consequential loss arising from use of the site. This sentence is a template. Counsel for the company must confirm what limits are actually enforceable before this text is treated as final.",
    ],
  },
  {
    id: "law",
    title: "Law and changes",
    paragraphs: [
      "These terms are drafted for a service operated from Addis Ababa, Ethiopia. The operator should confirm the governing law and the forum for disputes with counsel before relying on this clause.",
      "We may update this template. The date on this page will change when we do. Continued use after an update means you accept the published text.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      `Questions about these terms: ${operator}, ${SITE_OPERATOR.address}, telephone ${SITE_OPERATOR.phoneDisplay}.`,
    ],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "controller",
    title: "Who is responsible",
    paragraphs: [
      `${operator}, trade name ${trade}, operates mls.et and decides why account, listing, and enquiry information is used on this site. In this policy, "we" means that company.`,
      `Reach the operator at ${SITE_OPERATOR.address}, telephone ${SITE_OPERATOR.phoneDisplay}.`,
    ],
  },
  {
    id: "data",
    title: "Information the site handles",
    paragraphs: [
      "Account data: name, phone number, email, role, password hash or sign-in codes, and language preference.",
      "Listing data: property descriptions, prices, photos, documents you upload, location, and contact lines you attach to a listing.",
      "Enquiry data: the listing you asked about, the account that asked, consent to reveal a contact, and the message if you send one.",
      "Technical data: session cookie, approximate pages viewed, and security logs such as failed sign-in attempts.",
    ],
  },
  {
    id: "why",
    title: "Why it is used",
    paragraphs: [
      "To run accounts, publish or review listings, route enquiries, send SMS you asked for (including one-time codes), and keep the service secure.",
      "To show public teasers and, after you sign in, fuller listing details.",
      "The operator does not sell personal information as a standalone product. This policy is a template and does not describe a marketing-consent program that has not been built.",
    ],
  },
  {
    id: "sharing",
    title: "Who else may receive it",
    paragraphs: [
      "People involved in a listing you publish or enquire about, including the listing owner, broker, or developer, when that is required to complete the enquiry or the listing.",
      "Companies that host the site, store files, or send SMS, only so they can perform that work.",
      "AGT CRM (agtplc.et), when a scraped or imported listing candidate is sent there for staff review instead of being published live on mls.et. The owner should confirm this sentence still matches operations before treating the policy as final.",
      "A competent authority if Ethiopian law requires disclosure.",
    ],
  },
  {
    id: "retention",
    title: "How long it is kept",
    paragraphs: [
      "Account and listing records are kept while the account or listing is active, and longer if a dispute, audit, or legal duty requires it. The operator should set a written retention period with counsel. This paragraph does not invent one.",
    ],
  },
  {
    id: "requests",
    title: "Access, correction, and deletion",
    paragraphs: [
      "You may ask to see, correct, or delete account information by contacting the operator at the telephone and address above, or from your profile while signed in where the product allows an edit.",
      "We may refuse a request that would break a legal duty, a fraud review, or another person's rights. The exact rights you have depend on Ethiopian law. This policy does not restate that law.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    paragraphs: [
      "The site stores a session cookie so you stay signed in, a locale cookie so the language you chose sticks, and a currency preference. These are required to run the service you asked for. The site does not describe a third-party advertising cookie program.",
    ],
  },
  {
    id: "contact",
    title: "Changes and contact",
    paragraphs: [
      "We may replace this template. The page will show the new text. Questions: " +
        `${operator}, ${SITE_OPERATOR.address}, telephone ${SITE_OPERATOR.phoneDisplay}.`,
    ],
  },
];
