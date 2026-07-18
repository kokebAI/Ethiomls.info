import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { ADDIS_SUB_CITY_CODES, ADDIS_SUB_CITY_SET } from "@/lib/properties/subCities";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stay under Vercel’s 4.5 MB function body limit (multipart overhead included). */
const MAX_DOCUMENT_BYTES = 2.5 * 1024 * 1024;
const MAX_DOCUMENTS = 1;
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

function resolveMime(file: File): string {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return file.type;
}

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY?.trim() && !process.env.GOOGLE_GEMINI_BASE_URL?.trim()) {
      return NextResponse.json(
        {
          error:
            "Document parsing is unavailable. Set GEMINI_API_KEY in the deploy environment, then redeploy.",
        },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const documents = collectDocuments(formData).slice(0, MAX_DOCUMENTS);

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "No document file was uploaded." },
        { status: 400 },
      );
    }

    const file = documents[0]!;
    const mimeType = resolveMime(file);

    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
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
          error: `${file.name} must be under 2.5 MB. Compress the photo/PDF and try again.`,
        },
        { status: 413 },
      );
    }

    const ai = new GoogleGenAI({});
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data,
            mimeType,
          },
        },
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

    return NextResponse.json({
      data: {
        title: String(parsedJson.title ?? "").trim(),
        price: Number(parsedJson.price) || 0,
        subCity: normalizeSubCity(String(parsedJson.subCity ?? "")),
        bedrooms: Math.max(0, Math.floor(Number(parsedJson.bedrooms) || 0)),
        bathrooms: Math.max(0, Math.floor(Number(parsedJson.bathrooms) || 0)),
        sizeM2: Math.max(0, Number(parsedJson.sizeM2) || 0),
        description: String(parsedJson.description ?? "").trim(),
      },
    });
  } catch (error: unknown) {
    console.error("Document Parsing Failure:", error);
    const message =
      error instanceof Error ? error.message : "Parsing failed";
    const unavailable =
      /api key|GEMINI_API_KEY|not set|not configured|401|403|API_KEY_INVALID/i.test(
        message,
      );
    return NextResponse.json(
      {
        error: unavailable
          ? "Document parsing is unavailable right now. Check GEMINI_API_KEY and redeploy."
          : "The document could not be parsed. Please enter details manually.",
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}
