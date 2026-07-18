import { Type } from "@google/genai";
import { z } from "zod";
import {
  createGeminiClient,
  GEMINI_MODEL_CANDIDATES,
  isGeminiConfigured,
} from "@/lib/ai/gemini";
import { mapGeminiError } from "@/lib/ai/gemini-errors";
import { ADDIS_SUB_CITY_CODES, ADDIS_SUB_CITY_SET } from "@/lib/properties/subCities";

export const SALES_KIT_MAX_BYTES = 4 * 1024 * 1024;
export const SALES_KIT_MAX_FILES = 3;

const listingDraftSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).default(""),
  price: z.number().finite().nonnegative().default(0),
  currency: z.enum(["ETB", "USD"]).default("ETB"),
  subCity: z.string().trim().default("bole"),
  addressLine: z.string().trim().max(300).optional().default(""),
  bedrooms: z.number().int().nonnegative().default(0),
  bathrooms: z.number().int().nonnegative().default(0),
  sizeM2: z.number().finite().nonnegative().default(0),
  floor: z.number().int().optional().nullable(),
  unitLabel: z.string().trim().max(40).optional().nullable(),
  listingType: z.enum(["SALE", "RENT", "OFF_PLAN"]).default("OFF_PLAN"),
  category: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "LAND"])
    .default("COMMERCIAL"),
  projectName: z.string().trim().max(200).optional().nullable(),
});

export type SalesKitListingDraft = z.infer<typeof listingDraftSchema>;

const kitSchema = z.object({
  developerName: z.string().trim().max(200).optional().nullable(),
  projectName: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().max(300).optional().nullable(),
  listings: z.array(listingDraftSchema).min(1).max(40),
});

export type SalesKitParseResult = z.infer<typeof kitSchema>;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    developerName: { type: Type.STRING },
    projectName: { type: Type.STRING },
    website: { type: Type.STRING },
    listings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          price: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          subCity: { type: Type.STRING },
          addressLine: { type: Type.STRING },
          bedrooms: { type: Type.NUMBER },
          bathrooms: { type: Type.NUMBER },
          sizeM2: { type: Type.NUMBER },
          floor: { type: Type.NUMBER },
          unitLabel: { type: Type.STRING },
          listingType: { type: Type.STRING },
          category: { type: Type.STRING },
          projectName: { type: Type.STRING },
        },
        required: ["title", "description", "subCity", "listingType", "category"],
      },
    },
  },
  required: ["listings"],
};

function normalizeSubCity(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (ADDIS_SUB_CITY_SET.has(slug)) return slug;
  const aliases: Record<string, string> = {
    kazanchis: "kirkos",
    "shiromeda": "gullele",
    "shiro-meda": "gullele",
    megenagna: "yeka",
    gerji: "bole",
    ayat: "yeka",
    cmc: "yeka",
    "nifas-silk": "nifas-silk-lafto",
    kolfe: "kolfe-keranio",
    lemi: "lemi-kura",
    akaki: "akaky-kaliti",
  };
  const mapped = aliases[slug];
  if (mapped && ADDIS_SUB_CITY_SET.has(mapped)) return mapped;
  return ADDIS_SUB_CITY_CODES.includes(slug as (typeof ADDIS_SUB_CITY_CODES)[number])
    ? slug
    : "bole";
}

/** Extract plain text from a .docx (OOXML) buffer. */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("Invalid DOCX: missing word/document.xml");
  const xml = await doc.async("string");
  return xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function resolveSalesKitMime(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return file.type || "application/octet-stream";
}

export function isAcceptedSalesKitMime(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export async function parseSalesKitFiles(
  files: Array<{ name: string; mimeType: string; data: Buffer }>,
): Promise<SalesKitParseResult> {
  if (!isGeminiConfigured()) {
    throw new Error(
      "Document parsing is unavailable. Set GEMINI_API_KEY in the deploy environment.",
    );
  }

  const ai = createGeminiClient();
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [
    {
      text: `You are extracting Ethiopian real-estate inventory from a developer/broker sales kit.
Return EVERY distinct sellable unit, shop type, or floor product as a separate listings[] item (up to 40).
Prefer OFF_PLAN + COMMERCIAL for mall/shop kits. Use subCity as one of: ${ADDIS_SUB_CITY_CODES.join(", ")}.
Map Kazanchis→kirkos, Shiromeda→gullele, Megenagna→yeka, Gerji→bole, Ayat/CMC→yeka.
If price is missing, set price to 0 and note "price on request" in description.
Include floor and unitLabel when present. Keep titles concise.`,
    },
  ];

  for (const file of files) {
    if (
      file.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const text = await extractDocxText(file.data);
      parts.push({
        text: `--- Document: ${file.name} ---\n${text.slice(0, 80_000)}`,
      });
    } else {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data.toString("base64"),
        },
      });
    }
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
      if (!response.text) throw new Error("Empty Gemini response");
      const raw = JSON.parse(response.text) as unknown;
      const parsed = kitSchema.parse(raw);
      return {
        ...parsed,
        listings: parsed.listings.map((row) => ({
          ...row,
          subCity: normalizeSubCity(row.subCity),
          description:
            row.description ||
            (row.price <= 0
              ? `${row.title}. Price on request.`
              : row.title),
        })),
      };
    } catch (error) {
      lastError = error;
      console.warn(`[sales-kit-parse] model ${model} failed`, error);
    }
  }

  const mapped = mapGeminiError(lastError);
  throw Object.assign(new Error(mapped.message), {
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
}
