/**
 * Map Google GenAI / gateway failures into short, user-safe messages.
 */
export function mapGeminiError(error: unknown): {
  code: string;
  message: string;
  statusCode: number;
} {
  const raw =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error);
  const blob = raw.toLowerCase();

  if (
    blob.includes("permission_denied") ||
    blob.includes("denied access") ||
    (blob.includes('"code":403') && blob.includes("denied"))
  ) {
    return {
      code: "AiPermissionDenied",
      message:
        "Google denied this Gemini project (403). Create a new API key in Google AI Studio under a project with Generative Language API access (or enable billing), update GEMINI_API_KEY on Vercel, and redeploy.",
      statusCode: 403,
    };
  }

  if (
    blob.includes("api key not valid") ||
    blob.includes("api_key_invalid") ||
    blob.includes("invalid api key") ||
    blob.includes("access_token_type_unsupported")
  ) {
    return {
      code: "AiInvalidKey",
      message:
        "GEMINI_API_KEY was rejected by Google. Regenerate the key in AI Studio, restrict it to the Generative Language API, restart the server, and retry.",
      statusCode: 401,
    };
  }

  if (
    blob.includes("no longer available") ||
    blob.includes("not_found") ||
    (blob.includes('"code":404') && blob.includes("model"))
  ) {
    return {
      code: "AiModelUnavailable",
      message:
        "This Gemini model is not available for your project. Update GEMINI_MODEL (try gemini-3.5-flash or gemini-flash-latest).",
      statusCode: 404,
    };
  }

  if (
    blob.includes("quota") ||
    blob.includes("resource_exhausted") ||
    blob.includes('"code":429')
  ) {
    return {
      code: "AiQuotaExceeded",
      message:
        "Gemini quota exceeded for this model/project. Wait for the free-tier reset, enable billing in Google Cloud, or create a fresh AI Studio project + key. Guided search still works without AI.",
      statusCode: 429,
    };
  }

  return {
    code: "AiGenerationError",
    message:
      error instanceof Error ? error.message : "Failed to call Gemini",
    statusCode: 502,
  };
}
