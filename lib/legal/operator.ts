/**
 * Registry facts supplied by the operator for publication on mls.et.
 * Keep these strings identical in every language — they are legal identifiers,
 * not copy to translate.
 */
export const SITE_OPERATOR = {
  legalName: "ATITEGEB GENERAL TRADING PLC",
  tradeName: "kokeb AI tech",
  tin: "0003432679",
  businessLicense: "AACATB/14/672/50576857/2018",
  tradeNameRegistration: "MT/AA/2/0009136/2004",
  address: "Yeka Sub City, Woreda 08, Addis Ababa, Ethiopia",
  phoneDisplay: "0116622049",
  /** E.164 form of the Addis landline above. */
  phoneTel: "+251116622049",
} as const;

export function operatorFooterLine(): string {
  const { legalName, tradeName, tin, address } = SITE_OPERATOR;
  return `${legalName} (${tradeName}) · TIN ${tin} · ${address}`;
}
