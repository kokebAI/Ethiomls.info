import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { z } from "zod";
import { createGeminiClient } from "@/lib/ai/gemini";
import { ADDIS_SUB_CITY_CODES } from "@/lib/properties/subCities";

export const runtime = "nodejs";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const parsedPropertySchema = z.object({
  title: z.string().trim(),
  price: z.number().finite().nonnegative(),
  subCity: z.enum(ADDIS_SUB_CITY_CODES),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  description: z.string().trim(),
});

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
    description: {
      type: Type.STRING,
      description: "Accurate summary of property details found in the document.",
    },
  },
  required: [
    "title",
    "price",
    "subCity",
    "bedrooms",
    "bathrooms",
    "description",
  ],
  propertyOrdering: [
    "title",
    "price",
    "subCity",
    "bedrooms",
    "bathrooms",
    "description",
  ],
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const document = formData.get("document");

    if (!(document instanceof File)) {
      return NextResponse.json(
        { error: "Attach a document using the 'document' field." },
        { status: 400 },
      );
    }

    if (!ACCEPTED_MIME_TYPES.has(document.type)) {
      return NextResponse.json(
        { error: "Only PDF, JPEG, PNG, and WebP documents are supported." },
        { status: 415 },
      );
    }

    if (document.size === 0 || document.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        { error: "Document must be between 1 byte and 10 MB." },
        { status: 413 },
      );
    }

    const ai = createGeminiClient();
    const data = Buffer.from(await document.arrayBuffer()).toString("base64");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Act as an Ethiopian real-estate document parser. Read the
attached deed, brochure, or listing sheet and extract only facts supported by
the document. Return the sub-city as exactly one canonical slug from:
${ADDIS_SUB_CITY_CODES.join(", ")}.
Normalize spelling variants (for example "Bole" to "bole"). Preserve the
document's numeric price without currency conversion. Use 0 for a missing
numeric field and an empty string for missing text. Do not invent details.`,
            },
            {
              inlineData: {
                mimeType: document.type,
                data,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    const parsed = parsedPropertySchema.parse(JSON.parse(response.text));
    return NextResponse.json({ data: parsed });
  } catch (error) {
    console.error("[POST /api/properties/parse]", error);
    return NextResponse.json(
      { error: "The document could not be parsed. Please enter details manually." },
      { status: 502 },
    );
  }
}
