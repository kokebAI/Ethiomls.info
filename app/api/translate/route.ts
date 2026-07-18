import { NextResponse } from "next/server";
import { z } from "zod";
import {
  translateListingText,
  type TranslateTargetLanguage,
} from "@/lib/ai/translate-listing";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(8000),
  targetLanguage: z.enum(["am", "en"]),
});

/**
 * POST /api/translate
 * Body: `{ text: string, targetLanguage: "am" | "en" }`
 * Returns: `{ data: { text: string, targetLanguage } }`
 */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            'Provide { text: string, targetLanguage: "am" | "en" }.',
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const { text, targetLanguage } = parsed.data;
    const translated = await translateListingText(
      text,
      targetLanguage as TranslateTargetLanguage,
    );

    return NextResponse.json({
      data: {
        text: translated,
        targetLanguage,
      },
    });
  } catch (error: unknown) {
    console.error("[POST /api/translate]", error);
    const message =
      error instanceof Error ? error.message : "Translation failed";
    const unavailable = /api key|GEMINI_API_KEY|not set|401|403/i.test(
      message,
    );
    return NextResponse.json(
      {
        error: unavailable
          ? "Translation is unavailable. Check GEMINI_API_KEY and redeploy."
          : message,
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}
