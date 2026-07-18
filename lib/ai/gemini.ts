import { GoogleGenAI } from "@google/genai";

/**
 * Preferred model, then lighter / alternate Gemini models.
 * Env `GEMINI_MODEL` wins as first preference.
 * AQ.* AI Studio keys often reject older 2.5 flash IDs — prefer 3.x / *-latest.
 */
export const GEMINI_MODEL_CANDIDATES = uniqueModels([
  process.env.GEMINI_MODEL?.trim(),
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
]);

/** @deprecated Prefer GEMINI_MODEL_CANDIDATES[0] */
export const DEFAULT_GEMINI_MODEL =
  GEMINI_MODEL_CANDIDATES[0] ?? "gemini-3.5-flash";

function uniqueModels(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.length > 0 ? out : ["gemini-3.5-flash"];
}

function useVertexAi(): boolean {
  // Vertex requires Agent Platform / Vertex APIs enabled — opt-in only.
  const flag =
    process.env.GEMINI_VERTEXAI ?? process.env.GOOGLE_GENAI_USE_VERTEXAI;
  return ["1", "true", "yes", "on"].includes((flag ?? "").trim().toLowerCase());
}

function forceGoogleApi(): boolean {
  return ["1", "true", "yes", "on"].includes(
    (process.env.GEMINI_FORCE_GOOGLE_API ?? "").trim().toLowerCase(),
  );
}

function geminiBaseUrl(): string | undefined {
  return (
    process.env.GOOGLE_GEMINI_BASE_URL?.trim() ||
    process.env.NETLIFY_AI_GATEWAY_BASE_URL?.trim() ||
    undefined
  );
}

function geminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.NETLIFY_AI_GATEWAY_KEY?.trim() ||
    undefined
  );
}

/**
 * Google GenAI client.
 *
 * - Prefer Netlify/Vercel gateway injection via `new GoogleGenAI({})` when a
 *   gateway base URL is present (or when only placeholder keys exist).
 * - Local: set `GEMINI_API_KEY` (AI Studio `AIza…` keys work on the Developer API).
 * - Set `GEMINI_VERTEXAI=true` to force Vertex AI for AQ. / GCP keys.
 * - Set `GEMINI_FORCE_GOOGLE_API=1` to force the Developer API even for AQ. keys.
 */
export function createGeminiClient(): GoogleGenAI {
  const apiKey = geminiApiKey();
  const baseUrl = geminiBaseUrl();

  if (!apiKey && !baseUrl) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it in Vercel/Netlify env (or .env.local), or enable the AI Gateway.",
    );
  }

  // Gateway path: SDK reads injected GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL.
  // Pass explicit options when we resolved a non-standard gateway base URL.
  if (baseUrl) {
    if (
      baseUrl === process.env.GOOGLE_GEMINI_BASE_URL?.trim() &&
      process.env.GEMINI_API_KEY?.trim()
    ) {
      return new GoogleGenAI({});
    }
    return new GoogleGenAI({
      apiKey: apiKey || "ai-gateway",
      httpOptions: { baseUrl },
    });
  }

  const vertexai = useVertexAi();
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location =
    process.env.GOOGLE_CLOUD_LOCATION?.trim() ||
    process.env.VERTEX_LOCATION?.trim() ||
    "us-central1";

  if (vertexai && !forceGoogleApi()) {
    return new GoogleGenAI({
      vertexai: true,
      apiKey: apiKey!,
      ...(project ? { project, location } : {}),
    });
  }

  // Developer API — empty constructor still reads GEMINI_API_KEY from env.
  if (process.env.GEMINI_API_KEY?.trim()) {
    return new GoogleGenAI({});
  }

  return new GoogleGenAI({
    apiKey: apiKey!,
  });
}

export function isGeminiConfigured(): boolean {
  return Boolean(geminiApiKey() || geminiBaseUrl());
}

export function describeGeminiRuntime(): {
  vertexai: boolean;
  models: string[];
  keyPrefix: string;
  hasBaseUrl: boolean;
} {
  const key = geminiApiKey() ?? "";
  return {
    vertexai: useVertexAi() && !forceGoogleApi(),
    models: GEMINI_MODEL_CANDIDATES,
    keyPrefix: key.slice(0, 3),
    hasBaseUrl: Boolean(geminiBaseUrl()),
  };
}
