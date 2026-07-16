import { NextRequest, NextResponse } from "next/server";
import { describeGeminiRuntime, isGeminiConfigured } from "@/lib/ai/gemini";
import { mapGeminiError } from "@/lib/ai/gemini-errors";
import { runSearchAssist } from "@/lib/ai/search-assist";
import { isLocale } from "@/lib/i18n/config";
import { SUB_CITY_CLUSTERS } from "@/lib/search/clusters";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      {
        error: "AiNotConfigured",
        message:
          "Gemini is not configured. Enable Netlify AI Gateway (and deploy once), or set GEMINI_API_KEY for local development.",
        statusCode: 503,
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "InvalidJson",
        message: "Request body must be valid JSON",
        statusCode: 400,
      },
      { status: 400 },
    );
  }

  const query =
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as { query?: unknown }).query === "string"
      ? (body as { query: string }).query.trim()
      : "";

  const localeRaw =
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as { locale?: unknown }).locale === "string"
      ? (body as { locale: string }).locale
      : "en";

  const locale = isLocale(localeRaw) ? localeRaw : "en";

  if (query.length < 3 || query.length > 800) {
    return NextResponse.json(
      {
        error: "ValidationError",
        message: "query must be between 3 and 800 characters",
        statusCode: 400,
      },
      { status: 400 },
    );
  }

  try {
    const result = await runSearchAssist({ query, locale });
    const cluster = SUB_CITY_CLUSTERS.find((c) => c.id === result.clusterId);

    return NextResponse.json({
      data: {
        ...result,
        subCities: cluster ? [...cluster.subCities] : [],
      },
    });
  } catch (error) {
    console.error(
      "[POST /api/ai/search-assist]",
      describeGeminiRuntime(),
      error,
    );
    const mapped = mapGeminiError(error);
    return NextResponse.json(
      {
        error: mapped.code,
        message:
          error instanceof Error && error.message.length < 500
            ? error.message
            : mapped.message,
        statusCode: mapped.statusCode,
        runtime: describeGeminiRuntime(),
      },
      { status: mapped.statusCode },
    );
  }
}
