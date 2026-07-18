import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { ADDIS_SUB_CITY_CODES, ADDIS_SUB_CITY_SET } from "@/lib/properties/subCities";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stay under ~4.5 MB effective binary payload limit on serverless hosts. */
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const MAX_DOCUMENTS = 10;
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Automatically loads process.env.GEMINI_API_KEY (+ GOOGLE_GEMINI_BASE_URL if set).
const ai = new GoogleGenAI({});

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    price: { type: Type.NUMBER },
    subCity: { type: Type.STRING },
    bedrooms: { type: Type.NUMBER },
    bathrooms: { type: Type.NUMBER },
    sizeM2: { type: Type.NUMBER },
    description: { type: Type.STRING },
  },
  required: ["title", "price", "subCity", "description"],
};

function collectDocuments(formData: FormData): File[] {
  const files: File[] = [];
  for (const key of ["documents", "document", "file"] as const) {
    for (const value of formData.getAll(key)) {
      if (value instanceof File && value.size > 0) files.push(value);
    }
  }
  // Dedupe by name+size+lastModified when the same file is appended under multiple keys.
  const seen = new Set<string>();
  return files.filter((file) => {
    const id = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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
  return slug || "bole";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const documents = collectDocuments(formData).slice(0, MAX_DOCUMENTS);

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "No document file was uploaded." },
        { status: 400 },
      );
    }

    let totalBytes = 0;
    for (const file of documents) {
      if (!ACCEPTED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            error: `Unsupported type for ${file.name}. Only PDF, JPEG, PNG, and WebP are supported.`,
          },
          { status: 415 },
        );
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        return NextResponse.json(
          {
            error: `${file.name} must be under 4 MB.`,
          },
          { status: 413 },
        );
      }
      totalBytes += file.size;
    }

    if (totalBytes > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        {
          error:
            "Combined upload exceeds 4 MB. Upload documents one at a time, or compress large files.",
        },
        { status: 413 },
      );
    }

    const documentParts = await Promise.all(
      documents.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(arrayBuffer).toString("base64"),
            mimeType: file.type || "application/octet-stream",
          },
        };
      }),
    );

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
      contents: [
        ...documentParts,
        `Analyze this Ethiopian real-estate document or receipt.
Extract the property title, listing price, description, Addis Ababa sub-city,
number of bedrooms, bathrooms, and size in m² when present.
Return the sub-city as one of: ${ADDIS_SUB_CITY_CODES.join(", ")}.
Use 0 for missing numbers. Do not invent details.
Return a clean JSON object matching the requested structure.`,
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const parsedJson = JSON.parse(response.text || "{}") as {
      title?: string;
      price?: number;
      subCity?: string;
      bedrooms?: number;
      bathrooms?: number;
      sizeM2?: number;
      description?: string;
    };

    const data = {
      title: String(parsedJson.title ?? "").trim(),
      price: Number(parsedJson.price) || 0,
      subCity: normalizeSubCity(String(parsedJson.subCity ?? "")),
      bedrooms: Math.max(0, Math.floor(Number(parsedJson.bedrooms) || 0)),
      bathrooms: Math.max(0, Math.floor(Number(parsedJson.bathrooms) || 0)),
      sizeM2: Math.max(0, Number(parsedJson.sizeM2) || 0),
      description: String(parsedJson.description ?? "").trim(),
    };

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error("Document Parsing Failure:", error);
    const message =
      error instanceof Error ? error.message : "Parsing failed";
    const unavailable =
      /api key|GEMINI_API_KEY|not set|not configured|401|403/i.test(message);
    return NextResponse.json(
      {
        error: unavailable
          ? "Document parsing is unavailable right now. Check GEMINI_API_KEY and redeploy."
          : message || "The document could not be parsed. Please enter details manually.",
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}
