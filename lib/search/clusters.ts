import type { AddisSubCityCode } from "@/lib/properties/subCities";

export type SubCityClusterId =
  | "central"
  | "east"
  | "west"
  | "south";

export type SubCityCluster = {
  id: SubCityClusterId;
  /** Translation key under `search.clusters.*` */
  labelKey: string;
  descriptionKey: string;
  subCities: AddisSubCityCode[];
};

/**
 * Curated Addis Ababa sub-city clusters for conversational search.
 * Each cluster maps only to verified sub-city codes.
 */
export const SUB_CITY_CLUSTERS: SubCityCluster[] = [
  {
    id: "central",
    labelKey: "search.clusters.central",
    descriptionKey: "search.clusters.centralHint",
    subCities: ["arada", "kirkos", "lideta", "addis-ketema"],
  },
  {
    id: "east",
    labelKey: "search.clusters.east",
    descriptionKey: "search.clusters.eastHint",
    subCities: ["bole", "yeka", "lemi-kura"],
  },
  {
    id: "west",
    labelKey: "search.clusters.west",
    descriptionKey: "search.clusters.westHint",
    subCities: ["kolfe-keranio", "gullele"],
  },
  {
    id: "south",
    labelKey: "search.clusters.south",
    descriptionKey: "search.clusters.southHint",
    subCities: ["akaky-kaliti", "nifas-silk-lafto"],
  },
];
