/**
 * Canonical Addis Ababa sub-city codes (11 verified administrative headings).
 * Free-text or display-name variants are rejected by the property validator.
 */
export const ADDIS_SUB_CITY_CODES = [
  "addis-ketema",
  "akaky-kaliti",
  "arada",
  "bole",
  "gullele",
  "kirkos",
  "kolfe-keranio",
  "lideta",
  "nifas-silk-lafto",
  "yeka",
  "lemi-kura",
] as const;

export type AddisSubCityCode = (typeof ADDIS_SUB_CITY_CODES)[number];

export const ADDIS_SUB_CITY_SET = new Set<string>(ADDIS_SUB_CITY_CODES);

/** Banned free-text area heading keys — location must use `subCity` codes only. */
export const FORBIDDEN_AREA_HEADING_KEYS = [
  "area",
  "mainArea",
  "main_area",
  "areaName",
  "area_name",
  "neighborhood",
  "neighbourhood",
  "district",
  "locationName",
  "location_name",
  "subCityName",
  "sub_city_name",
  "cityArea",
  "city_area",
] as const;

export function isAddisSubCityCode(value: string): value is AddisSubCityCode {
  return ADDIS_SUB_CITY_SET.has(value);
}
