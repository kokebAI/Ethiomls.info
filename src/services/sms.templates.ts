import type { Locale } from "@/lib/i18n/config";
import { isLocale } from "@/lib/i18n/config";

export type SmsLocale = Locale;

export function resolveSmsLocale(
  localePrefs: unknown,
): SmsLocale {
  const list = Array.isArray(localePrefs)
    ? localePrefs.filter((code): code is string => typeof code === "string")
    : [];
  const preferred = list.find((code) => isLocale(code));
  return preferred ?? "am";
}

export type SmsTemplateId =
  | "new_lead_alert"
  | "listing_expiry_reminder"
  | "verification_update"
  | "listing_archived";

type TemplateParams = {
  url?: string;
  kind?: "mesob" | "escrow";
};

/** Escape helper keeps Ethiopic copy out of editor corruption paths. */
function u(parts: string[]): string {
  return parts.join("");
}

const AM_NEW_LEAD = u([
  "\u12A5\u122D\u1235\u12CA\u12CE \u12E8\u1208\u1320\u1349\u1275 \u1295\u1265\u1228\u1275 ",
  "\u12A0\u12F2\u1235 \u1308\u12E5/\u1270\u12A8\u122B\u12ED \u12ED\u1348\u120D\u130B\u120D\u1362 ",
  "\u12DD\u122D\u12DD\u1229\u1295 \u1208\u1218\u1218\u120D\u12A8\u1275 {url} \u12ED\u12AD\u1348\u1271\u1362",
]);

const AM_EXPIRY = u([
  "\u12E8\u1208\u1320\u1349\u1275 \u1295\u1265\u1228\u1275 \u12A8\u0035 \u1240\u1295 \u1260\u12A5\u120B\u120B ",
  "\u1218\u12DD\u1308\u1265 \u1264\u1275 \u12ED\u1308\u1263\u120D\u1362 \u1208\u121B\u12F0\u1235 {url} \u12ED\u132B\u1291\u1362",
]);

const AM_MESOB = u([
  "\u12E8\u1266\u1273 \u120B\u12ED Mesob \u121D\u122D\u1218\u122B \u1270\u1326\u1293\u124B\u120D\u1362 ",
  "\u1295\u1265\u1228\u1276 \u1260EthioMLS \u120B\u12ED \u12A5\u1295\u12F0\u1270\u1228\u130B\u1308\u1320 \u1270\u1218\u12DD\u130D\u1267\u120D\u1362",
]);

const AM_ESCROW = u([
  "\u12E8\u12A4\u1235\u12AD\u122E\u12CD \u121B\u1228\u130B\u1308\u132B \u1270\u1326\u1293\u124B\u120D\u1362 ",
  "\u1295\u1265\u1228\u1276 \u1260EthioMLS \u120B\u12ED \u12A5\u1295\u12F0\u1270\u1228\u130B\u1308\u1320 \u1270\u1218\u12DD\u130D\u1267\u120D\u1362",
]);

const AM_ARCHIVED = u([
  "\u1295\u1265\u1228\u1276 \u1260\u0033\u0030 \u1240\u1295 \u12EB\u1208\u121B\u12F0\u1235 \u121D\u12AD\u1295\u12EB\u1275 ",
  "\u12C8\u12F0 \u121B\u1205\u12F0\u122D \u1308\u1265\u1277\u120D\u1362 \u1208\u121B\u12F0\u1235\u1293 \u12A5\u1295\u12F0\u1308\u1293 ",
  "\u1208\u121B\u1235\u1290\u1233\u1275 {url} \u12ED\u132B\u1291\u1362",
]);

const TI_NEW_LEAD = u([
  "\u12A5\u1272 \u12DD\u1208\u1320\u134D\u12A9\u121D\u12CE \u1295\u1265\u1228\u1275 \u1203\u12F5\u123D ",
  "\u12D3\u12F0\u1243\u12ED/\u1270\u12AB\u122B\u12ED \u12ED\u12F0\u120A \u12A3\u120E\u1362 ",
  "\u12DD\u122D\u12DD\u122D lead \u1295\u121D\u122D\u12A3\u12ED\u1361 {url}",
]);

const TI_EXPIRY = u([
  "\u12A5\u1272 \u12DD\u1208\u1320\u134D\u12A9\u121D\u12CE \u1295\u1265\u1228\u1275 \u12F5\u1215\u122A 5 ",
  "\u1218\u12D3\u120D\u1272 \u1293\u1265 archive \u12AA\u12A8\u12CD\u1295 \u12A5\u12E9\u1362 ",
  "\u1295\u121D\u1215\u12F3\u1235\u1361 {url} \u12ED\u133D\u12D3\u1271\u1362",
]);

const TI_MESOB = u([
  "\u1293\u12ED \u1266\u1273 Mesob \u1218\u122D\u1218\u122B \u1270\u12DB\u12DA\u1219\u1362 ",
  "\u1295\u1265\u1228\u1275\u12A9\u121D \u12A3\u1265 EthioMLS \u12A8\u121D \u12DD\u1270\u1228\u130B\u1308\u1338 \u1270\u1218\u12DD\u130A\u1261\u1362",
]);

const TI_ESCROW = u([
  "\u121D\u122D\u130D\u130B\u133D \u12A4\u1235\u12AD\u122E\u12CD \u1270\u12DB\u12DA\u1219\u1362 ",
  "\u1295\u1265\u1228\u1275\u12A9\u121D \u12A3\u1265 EthioMLS \u12A8\u121D \u12DD\u1270\u1228\u130B\u1308\u1338 \u1270\u1218\u12DD\u130A\u1261\u1362",
]);

const TI_ARCHIVED = u([
  "\u1295\u1265\u1228\u1275\u12A9\u121D \u1265\u1230\u1295\u12AA 30 \u1218\u12D3\u120D\u1272 \u12D8\u12ED\u121D\u1215\u12F3\u1235 ",
  "\u1293\u1265 archive \u12A3\u1272\u12E9\u1362 \u1295\u121D\u1215\u12F3\u1235\u1361 {url}",
]);

function fill(template: string, params: TemplateParams): string {
  return template.replaceAll("{url}", params.url ?? "https://ethiomls.info");
}

export function renderSmsTemplate(
  templateId: SmsTemplateId,
  locale: SmsLocale,
  params: TemplateParams = {},
): string {
  const table: Record<SmsTemplateId, Record<SmsLocale, string>> = {
    new_lead_alert: {
      am: AM_NEW_LEAD,
      om: "Qabeenyi keessan bittoota/kireessitoota haaraa barbaada. Ibsa lead ilaaluuf: {url}",
      ti: TI_NEW_LEAD,
      en: "A client is inquiring about your property. View lead details: {url}",
    },
    listing_expiry_reminder: {
      am: AM_EXPIRY,
      om: "Qabeenyi keessan guyyaa 5 booda archive ta'a. Haaromsuuf: {url}",
      ti: TI_EXPIRY,
      en: "Your listing will archive in 5 days (30-day freshness rule). Renew now: {url}",
    },

    verification_update: {
      am: params.kind === "escrow" ? AM_ESCROW : AM_MESOB,
      om:
        params.kind === "escrow"
          ? "Mirkaneessa eskiroo xumurameera. Qabeenyi keessan EthioMLS irratti mirkanaa'eera."
          : "Qiama Mesob bakka irratti xumurameera. Qabeenyi keessan EthioMLS irratti mirkanaa'eera.",
      ti: params.kind === "escrow" ? TI_ESCROW : TI_MESOB,
      en:
        params.kind === "escrow"
          ? "Escrow verification is complete. Your EthioMLS listing is now marked verified."
          : "On-site Mesob check is complete. Your EthioMLS listing is now marked verified.",
    },
    listing_archived: {
      am: AM_ARCHIVED,
      om: "Qabeenyi keessan guyyaa 30 fudhatamee archive ta'eera. Haaromsuuf: {url}",
      ti: TI_ARCHIVED,
      en: "Your listing was archived after 30 days without a refresh. Renew it here: {url}",
    },
  };

  const localized = table[templateId][locale] ?? table[templateId].am;
  return fill(localized, params);
}
