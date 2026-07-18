/**
 * Classify pending listings for the admin audit queue tabs.
 */

export type AuditPartyCategory =
  | "developers"
  | "brokers"
  | "owners"
  | "imported";

const IMPORT_TAG_PREFIXES = ["import", "sales-kit-import"] as const;

export function isImportTagged(metadataTags: string[]): boolean {
  return metadataTags.some(
    (tag) =>
      IMPORT_TAG_PREFIXES.includes(tag as (typeof IMPORT_TAG_PREFIXES)[number]) ||
      tag.startsWith("source:telegram") ||
      tag.startsWith("source:website") ||
      tag.startsWith("source:facebook"),
  );
}

export function classifyListingParty(input: {
  developerId: string | null | undefined;
  delalaId: string | null | undefined;
  metadataTags: string[];
  ownerRole: string;
}): AuditPartyCategory {
  if (isImportTagged(input.metadataTags)) {
    return "imported";
  }
  if (
    input.developerId ||
    input.ownerRole === "CORPORATE_DEVELOPER"
  ) {
    return "developers";
  }
  if (input.delalaId || input.ownerRole === "INDEPENDENT_DELALA") {
    return "brokers";
  }
  if (input.ownerRole === "PROPERTY_OWNER") {
    return "owners";
  }
  // Admin-owned or unknown without a party profile → treat as import triage bucket
  return "imported";
}

export function partyLabelFromListing(input: {
  developerTradeName?: string | null;
  delalaDisplayName?: string | null;
  ownerFullName?: string | null;
  ownerRole?: string | null;
}): string {
  if (input.developerTradeName?.trim()) return input.developerTradeName.trim();
  if (input.delalaDisplayName?.trim()) return input.delalaDisplayName.trim();
  if (input.ownerFullName?.trim()) return input.ownerFullName.trim();
  return input.ownerRole?.replaceAll("_", " ") ?? "Unknown";
}
