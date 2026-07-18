import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { z } from "zod";
import {
  createGeminiClient,
  GEMINI_MODEL_CANDIDATES,
} from "@/lib/ai/gemini";
import { ADDIS_SUB_CITY_CODES, ADDIS_SUB_CITY_SET } from "@/lib/properties/subCities";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stay under Netlify's ~4.5 MB effective binary payload limit (6 MB buffered + base64 overhead). */
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const MAX_DOCUMENTS = 10;
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const listingTypeSchema = z.enum(["SALE", "RENT", "OFF_PLAN"]);
const propertyTypeSchema = z.enum([
  "RESIDENTIAL",
  "COMMERCIAL",
  "MIXED_USE",
  "LAND",
]);
const currencySchema = z.enum(["ETB", "USD"]);

const parsedPropertySchema = z.object({
  title: z.string().trim(),
  price: z.number().finite().nonnegative(),
  currency: currencySchema.default("ETB"),
  subCity: z.string().trim(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  sizeM2: z.number().finite().nonnegative().default(0),
  description: z.string().trim(),
  addressLine: z.string().trim().default(""),
  listingType: listingTypeSchema.default("SALE"),
  propertyType: propertyTypeSchema.default("RESIDENTIAL"),
});

export type ParsedPropertyFields = z.infer<typeof parsedPropertySchema>;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Concise property listing title.",
    },
    price: {
      type: Type.NUMBER,
      description: "Numeric asking price exactly as shown. Use 0 if absent.",
    },
    currency: {
      type: Type.STRING,
      enum: ["ETB", "USD"],
      description: "Price currency. Default ETB.",
    },
    subCity: {
      type: Type.STRING,
      enum: [...ADDIS_SUB_CITY_CODES],
      description: "Canonical Addis Ababa sub-city slug.",
    },
    bedrooms: {
      type: Type.INTEGER,
      description: "Bedroom count. Use 0 if absent.",
    },
    bathrooms: {
      type: Type.INTEGER,
      description: "Bathroom count. Use 0 if absent.",
    },
    sizeM2: {
      type: Type.NUMBER,
      description: "Floor or plot size in square meters. Use 0 if absent.",
    },
    description: {
      type: Type.STRING,
      description:
        "Accurate summary of property details found in the documents.",
    },
    addressLine: {
      type: Type.STRING,
      description: "Street, landmark, or unit address if present.",
    },
    listingType: {
      type: Type.STRING,
      enum: ["SALE", "RENT", "OFF_PLAN"],
      description: "Listing intent. Default SALE.",
    },
    propertyType: {
      type: Type.STRING,
      enum: ["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "LAND"],
      description: "Property category. Default RESIDENTIAL.",
    },
  },
  required: [
    "title",
    "price",
    "currency",
    "subCity",
    "bedrooms",
    "bathrooms",
    "sizeM2",
    "description",
    "addressLine",
    "listingType",
    "propertyType",
  ],
  propertyOrdering: [
    "title",
    "price",
    "currency",
    "subCity",
    "bedrooms",
    "bathrooms",
    "sizeM2",
    "description",
    "addressLine",
    "listingType",
    "propertyType",
  ],
};

function collectDocuments(formData: FormData): File[] {
  const files: File[] = [];
  for (const value of formData.getAll("documents")) {
    if (value instanceof File) files.push(value);
  }
  const single = formData.get("document");
  if (single instanceof File) files.push(single);
  return files;
}

function normalizeSubCity(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (ADDIS_SUB_CITY_SET.has(slug)) return slug;

  const aliases: Record<string, string> = {
    "nifas-silk": "nifas-silk-lafto",
    "nifas-silklafto": "nifas-silk-lafto",
    kolfe: "kolfe-keranio",
    lemi: "lemi-kura",
    akaki: "akaky-kaliti",
    akaky: "akaky-kaliti",
  };
  const mapped = aliases[slug];
  if (mapped && ADDIS_SUB_CITY_SET.has(mapped)) return mapped;

  // Safe default when the model returns an unrecognized area name.
  return "bole";
}

async function parseWithGemini(files: File[]) {
  const ai = createGeminiClient();
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `Act as an Ethiopian real-estate document parser. Read the
attached deed(s), brochure(s), photo(s), or listing sheet(s) and extract only
facts supported by the documents. When multiple documents are attached, merge
them into one coherent property record (prefer explicit numbers over guesses).
Return the sub-city as exactly one canonical slug from:
${ADDIS_SUB_CITY_CODES.join(", ")}.
Normalize spelling variants (for example "Bole" to "bole"). Preserve the
document's numeric price without currency conversion. Use 0 for a missing
numeric field and an empty string for missing text. Do not invent details.`,
    },
  ];

  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    parts.push({
      inlineData: {
        mimeType: file.type || "application/octet-stream",
        data,
      },
    });
  }

  let lastError: unknown;
  for (const model of GEMINI_MODEL_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty response.");
      }

      const raw = JSON.parse(response.text) as Record<string, unknown>;
      const parsed = parsedPropertySchema.parse({
        ...raw,
        subCity: normalizeSubCity(String(raw.subCity ?? "")),
      });
      return parsed;
    } catch (error) {
      lastError = error;
      console.warn(`[POST /api/properties/parse] model ${model} failed`, error);
    }
  }

  throw lastError ?? new Error("All Gemini models failed.");
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_DOCUMENT_BYTES * MAX_DOCUMENTS + 512_000) {
      return NextResponse.json(
        {
          error:
            "Upload is too large for the server. Use files under 4 MB each, or upload fewer documents at once.",
        },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const documents = collectDocuments(formData);

    if (documents.length === 0) {
      return NextResponse.json(
        {
          error:
            "Attach at least one document using the 'documents' (or 'document') field.",
        },
        { status: 400 },
      );
    }

    if (documents.length > MAX_DOCUMENTS) {
      return NextResponse.json(
        { error: `You can upload at most ${MAX_DOCUMENTS} documents per request.` },
        { status: 400 },
      );
    }

    let totalBytes = 0;
    for (const document of documents) {
      if (!ACCEPTED_MIME_TYPES.has(document.type)) {
        return NextResponse.json(
          {
            error: `Unsupported type for ${document.name}. Only PDF, JPEG, PNG, and WebP are supported.`,
          },
          { status: 415 },
        );
      }
      if (document.size === 0 || document.size > MAX_DOCUMENT_BYTES) {
        return NextResponse.json(
          {
            error: `${document.name} must be between 1 byte and 4 MB (Netlify upload limit).`,
          },
          { status: 413 },
        );
      }
      totalBytes += document.size;
    }

    if (totalBytes > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        {
          error:
            "Combined upload exceeds 4 MB. Upload documents one at a time, or compress large PDFs/photos.",
        },
        { status: 413 },
      );
    }

    const parsed = await parseWithGemini(documents);
    return NextResponse.json({ data: parsed });
  } catch (error) {
    console.error("[POST /api/properties/parse]", error);
    const message =
      error instanceof Error && /GEMINI_API_KEY|not set/i.test(error.message)
        ? "Document parsing is unavailable right now. Please enter details manually."
        : "The document could not be parsed. Please enter details manually.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
