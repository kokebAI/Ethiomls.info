import { z } from "zod";
import {
  ConstructionStage,
  CurrencyCode,
  ListingType,
  PropertyCategory,
} from "@prisma/client";
import {
  DataCompletenessError,
  type CompletenessIssue,
} from "@/lib/errors/DataCompletenessError";
import {
  ADDIS_SUB_CITY_CODES,
  FORBIDDEN_AREA_HEADING_KEYS,
} from "@/lib/properties/subCities";

const CURRENCY_TAGS = [CurrencyCode.ETB, CurrencyCode.USD] as const;

const nonEmptyStringArray = z
  .array(z.string().trim().min(1))
  .min(1, "Metadata arrays must contain at least one entry");

/**
 * Strict property creation schema.
 * - `subCity` must be one of the 11 verified Addis Ababa codes (no free-text).
 * - `sizeM2` must be a strictly positive integer.
 * - Metadata / gallery / panorama arrays may not be empty when supplied.
 * - `currency` must be a structural CurrencyCode tag (ETB | USD).
 * - Escrow fields are optional at the Zod layer; unfinished stock is enforced
 *   later by `assertEscrowCompliance` (EscrowComplianceException).
 */
export const createPropertySchema = z
  .object({
    ownerId: z.string().min(1, "ownerId is required"),
    title: z.object({
      en: z.string().trim().min(1),
      am: z.string().trim().min(1).optional(),
      om: z.string().trim().min(1).optional(),
      ti: z.string().trim().min(1).optional(),
    }),
    description: z.object({
      en: z.string().trim().min(1),
      am: z.string().trim().min(1).optional(),
      om: z.string().trim().min(1).optional(),
      ti: z.string().trim().min(1).optional(),
    }),
    listingType: z.nativeEnum(ListingType),
    propertyType: z.nativeEnum(PropertyCategory),
    subCity: z.enum(ADDIS_SUB_CITY_CODES, {
      errorMap: () => ({
        message:
          "subCity must be one of the 11 verified Addis Ababa sub-city codes",
      }),
    }),
    price: z.number().finite().positive("price must be a positive number"),
    currency: z.enum(CURRENCY_TAGS, {
      errorMap: () => ({
        message: "currency must be a structural tag: ETB or USD",
      }),
    }),
    bedrooms: z.number().int().nonnegative(),
    bathrooms: z.number().int().nonnegative().optional(),
    sizeM2: z
      .number({
        required_error: "sizeM2 is required",
        invalid_type_error: "sizeM2 must be a strictly positive integer",
      })
      .int("sizeM2 must be a strictly positive integer")
      .positive("sizeM2 must be a strictly positive integer"),
    metadata: nonEmptyStringArray,
    panoramicImageUrls: nonEmptyStringArray.optional(),
    galleryImageUrls: nonEmptyStringArray.optional(),
    addressLine: z.string().trim().min(1).optional(),
    developerId: z.string().min(1).optional(),
    delalaId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    openToForeignBuyers: z.boolean().optional(),
    isUnfinished: z.boolean().optional(),
    constructionStage: z.nativeEnum(ConstructionStage).optional(),
    escrowAccountNumber: z.string().trim().min(1).optional(),
    bankEscrowProvider: z.string().trim().min(1).optional(),
    constructionPermitId: z.string().trim().min(1).optional(),
    constructionPermitVerified: z.boolean().optional(),
  })
  .strict();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

function zodIssuesToCompleteness(
  error: z.ZodError,
): CompletenessIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validates a property creation payload.
 * Throws DataCompletenessError (HTTP 400) on any failure.
 */
export function validateCreatePropertyPayload(
  raw: unknown,
): CreatePropertyInput {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DataCompletenessError("Request body must be a JSON object", [
      { path: "(root)", message: "Expected a JSON object", code: "invalid_type" },
    ]);
  }

  const record = raw as Record<string, unknown>;

  const forbiddenPresent = FORBIDDEN_AREA_HEADING_KEYS.filter(
    (key) => key in record,
  );
  if (forbiddenPresent.length > 0) {
    throw new DataCompletenessError(
      "Free-text main area headings are not allowed; use a verified subCity code",
      forbiddenPresent.map((key) => ({
        path: key,
        message:
          "Custom free-text area headings are blocked. Provide subCity as a verified Addis Ababa code only.",
        code: "forbidden_area_heading",
      })),
    );
  }

  if (
    typeof record.subCity === "string" &&
    !(ADDIS_SUB_CITY_CODES as readonly string[]).includes(record.subCity)
  ) {
    throw new DataCompletenessError(
      "Location must map to a verified Addis Ababa sub-city code",
      [
        {
          path: "subCity",
          message: `Unknown sub-city "${record.subCity}". Allowed: ${ADDIS_SUB_CITY_CODES.join(", ")}`,
          code: "unverified_sub_city",
        },
      ],
    );
  }

  for (const key of ["metadata", "panoramicImageUrls", "galleryImageUrls"] as const) {
    if (key in record && Array.isArray(record[key]) && record[key].length === 0) {
      throw new DataCompletenessError("Empty metadata arrays are not allowed", [
        {
          path: key,
          message: `${key} must not be an empty array`,
          code: "empty_metadata_array",
        },
      ]);
    }
  }

  if (
    "currency" in record &&
    typeof record.currency === "string" &&
    !(CURRENCY_TAGS as readonly string[]).includes(record.currency)
  ) {
    throw new DataCompletenessError("Invalid structural currency tag", [
      {
        path: "currency",
        message: "currency must be ETB or USD",
        code: "invalid_currency_tag",
      },
    ]);
  }

  const parsed = createPropertySchema.safeParse(raw);
  if (!parsed.success) {
    throw new DataCompletenessError(
      "Property payload failed completeness validation",
      zodIssuesToCompleteness(parsed.error),
    );
  }

  return parsed.data;
}
