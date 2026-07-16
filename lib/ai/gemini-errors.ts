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
        "Google denied this Gemini project (403 PERMISSION_DENIED). This is usually an account/project block—not a wrong model. In AI Studio check the project banner, enable Billing if required, create a fresh project + key, or contact Google support. You can also set GEMINI_VERTEXAI=true / GOOGLE_CLOUD_PROJECT=… or GEMINI_FORCE_GOOGLE_API=1 and retry.",
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
