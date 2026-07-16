import { GoogleGenAI } from "@google/genai";

/**
 * Preferred model, then lighter / alternate Gemini models.
 * Env `GEMINI_MODEL` wins as first preference.
 */
export const GEMINI_MODEL_CANDIDATES = uniqueModels([
  process.env.GEMINI_MODEL?.trim(),
  // 2.0 lite is often the only model still admitted on restricted AQ.* projects
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
]);

/** @deprecated Prefer GEMINI_MODEL_CANDIDATES[0] */
export const DEFAULT_GEMINI_MODEL =
  GEMINI_MODEL_CANDIDATES[0] ?? "gemini-2.0-flash-lite";

function uniqueModels(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.length > 0 ? out : ["gemini-2.0-flash-lite"];
}

function useVertexAi(): boolean {
  // Vertex requires Agent Platform / Vertex APIs enabled — opt-in only.
  const flag =
    process.env.GEMINI_VERTEXAI ?? process.env.GOOGLE_GENAI_USE_VERTEXAI;
  return ["1", "true", "yes", "on"].includes((flag ?? "").trim().toLowerCase());
}

/**
 * Google GenAI client.
 *
 * - Default: Gemini Developer API with `GEMINI_API_KEY`
 * - Set `GEMINI_VERTEXAI=true` (or leave AQ. keys on auto) to try Vertex AI
 * - Set `GEMINI_FORCE_GOOGLE_API=1` to force the Developer API even for AQ. keys
 */
export function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const baseUrl = process.env.GOOGLE_GEMINI_BASE_URL?.trim();

  if (!apiKey && !process.env.NETLIFY_AI_GATEWAY_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (local) or Netlify env vars (deploy).",
    );
  }

  if (baseUrl) {
    return new GoogleGenAI({
      apiKey: apiKey || process.env.NETLIFY_AI_GATEWAY_KEY,
      httpOptions: { baseUrl },
    });
  }

  const vertexai = useVertexAi();
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location =
    process.env.GOOGLE_CLOUD_LOCATION?.trim() ||
    process.env.VERTEX_LOCATION?.trim() ||
    "us-central1";

  if (vertexai) {
    return new GoogleGenAI({
      vertexai: true,
      apiKey: apiKey!,
      ...(project ? { project, location } : {}),
    });
  }

  return new GoogleGenAI({
    apiKey: apiKey!,
  });
}

export function isGeminiConfigured(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.NETLIFY_AI_GATEWAY_KEY?.trim(),
  );
}

export function describeGeminiRuntime(): {
  vertexai: boolean;
  models: string[];
  keyPrefix: string;
} {
  const key = process.env.GEMINI_API_KEY?.trim() ?? "";
  return {
    vertexai: useVertexAi(),
    models: GEMINI_MODEL_CANDIDATES,
    keyPrefix: key.slice(0, 3),
  };
}
