import {
  createGeminiClient,
  GEMINI_MODEL_CANDIDATES,
} from "@/lib/ai/gemini";
import { mapGeminiError } from "@/lib/ai/gemini-errors";
import {
  SUB_CITY_CLUSTERS,
  type SubCityClusterId,
} from "@/lib/search/clusters";

export type SearchIntent = "buy" | "rent" | "off_plan";
export type BudgetCurrency = "ETB" | "USD";

export type SearchAssistResult = {
  intent: SearchIntent;
  clusterId: SubCityClusterId;
  budgetAmount: number;
  budgetCurrency: BudgetCurrency;
  summary: string;
  minCompletionPercent?: number;
};

const CLUSTER_IDS = SUB_CITY_CLUSTERS.map((c) => c.id);
const INTENT_IDS = ["buy", "rent", "off_plan"] as const;

function buildPrompt(query: string, locale: string): string {
  const clusterGuide = SUB_CITY_CLUSTERS.map(
    (c) => `- ${c.id}: ${c.subCities.join(", ")}`,
  ).join("\n");

  return `You help EthioMLS, an Ethiopian real-estate MLS for Addis Ababa.
Parse the buyer's free-text request into structured search fields.

Locale hint (user UI language): ${locale}

Allowed intent values: buy, rent, off_plan
Allowed clusterId values:
${clusterGuide}

Rules for money:
- budgetCurrency must be exactly "ETB" or "USD" (default ETB if unclear).
- budgetAmount must be a JSON number (not a string). Use full digits, e.g. 5000000 not "5 million".
- Rent budgets are monthly; buy/off_plan are purchase targets.

For off_plan only, include minCompletionPercent as 0, 25, 50, 80, or 100 when the user mentions construction progress; otherwise use 0.

Respond with ONLY valid JSON (no markdown), shape:
{
  "intent": "buy",
  "clusterId": "central",
  "budgetAmount": 5000000,
  "budgetCurrency": "ETB",
  "minCompletionPercent": 0,
  "summary": "one short sentence in the user's language confirming understanding"
}

User request:
"""${query.trim().slice(0, 800)}"""`;
}

function coerceIntent(value: unknown): SearchIntent | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((INTENT_IDS as readonly string[]).includes(normalized)) {
    return normalized as SearchIntent;
  }
  if (normalized.includes("rent") || normalized.includes("lease")) return "rent";
  if (
    normalized.includes("off_plan") ||
    normalized.includes("offplan") ||
    normalized.includes("under_construction")
  ) {
    return "off_plan";
  }
  if (
    normalized.includes("buy") ||
    normalized.includes("sale") ||
    normalized.includes("purchase")
  ) {
    return "buy";
  }
  return null;
}

function coerceClusterId(value: unknown): SubCityClusterId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (CLUSTER_IDS.includes(normalized as SubCityClusterId)) {
    return normalized as SubCityClusterId;
  }
  for (const cluster of SUB_CITY_CLUSTERS) {
    if (cluster.subCities.some((code) => normalized.includes(code))) {
      return cluster.id;
    }
    if (normalized.includes(cluster.id)) return cluster.id;
  }
  return null;
}

function coerceCurrency(value: unknown): BudgetCurrency {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "USD" || normalized.includes("DOLLAR") || normalized === "$") {
      return "USD";
    }
    if (
      normalized === "ETB" ||
      normalized.includes("BIRR") ||
      normalized.includes("ETHIOP")
    ) {
      return "ETB";
    }
  }
  return "ETB";
}

/** Parse model money fields that often come back as strings like "5 million". */
function coerceBudgetAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") return null;

  const raw = value.trim().toLowerCase().replace(/,/g, "");
  if (!raw) return null;

  const match = raw.match(
    /(\d+(?:\.\d+)?)\s*(k|m|million|billion|bn|thousand)?/,
  );
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base) || base <= 0) return null;
  const unit = match[2] ?? "";
  if (unit === "k" || unit === "thousand") return base * 1_000;
  if (unit === "m" || unit === "million") return base * 1_000_000;
  if (unit === "billion" || unit === "bn") return base * 1_000_000_000;
  return base;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model did not return a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function normalizeSearchAssist(
  raw: Record<string, unknown>,
): SearchAssistResult {
  const intent = coerceIntent(raw.intent);
  if (!intent) {
    throw new Error("Invalid intent from model");
  }

  const clusterId = coerceClusterId(raw.clusterId);
  if (!clusterId) {
    throw new Error("Invalid clusterId from model");
  }

  const budgetCurrency = coerceCurrency(
    raw.budgetCurrency ?? raw.currency ?? raw.budget_currency,
  );

  const amount = coerceBudgetAmount(
    raw.budgetAmount ?? raw.budget ?? raw.amount ?? raw.budget_amount,
  );
  if (amount == null) {
    throw new Error("Invalid budgetAmount from model");
  }

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim().slice(0, 280)
      : "Search preferences understood.";

  let minCompletionPercent: number | undefined;
  if (intent === "off_plan") {
    const pctRaw =
      raw.minCompletionPercent ?? raw.min_completion_percent ?? raw.completion;
    const pct = Math.round(Number(pctRaw));
    if (Number.isFinite(pct)) {
      minCompletionPercent = Math.max(0, Math.min(100, pct));
    } else {
      minCompletionPercent = 0;
    }
  }

  return {
    intent,
    clusterId,
    budgetAmount: amount,
    budgetCurrency,
    summary,
    minCompletionPercent,
  };
}

export async function runSearchAssist(input: {
  query: string;
  locale?: string;
}): Promise<SearchAssistResult> {
  const query = input.query.trim();
  if (query.length < 3) {
    throw new Error("Query too short");
  }

  const ai = createGeminiClient();
  const prompt = buildPrompt(query, input.locale ?? "en");
  let lastError: unknown;
  let lastParseError: unknown;

  for (const model of GEMINI_MODEL_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (!text?.trim()) {
        throw new Error(`Empty model response from ${model}`);
      }

      return normalizeSearchAssist(parseJsonObject(text));
    } catch (error) {
      lastError = error;
      const mapped = mapGeminiError(error);
      if (mapped.code === "AiInvalidKey" || mapped.code === "AiPermissionDenied") {
        throw new Error(mapped.message);
      }
      // Prefer parse/normalize failures over later "model unavailable" noise.
      if (
        mapped.code !== "AiModelUnavailable" &&
        error instanceof Error &&
        (error.message.includes("Invalid ") ||
          error.message.includes("JSON") ||
          error.message.includes("Empty model"))
      ) {
        lastParseError = error;
      }
      console.warn(`[search-assist] model ${model} failed:`, mapped.message);
    }
  }

  if (lastParseError instanceof Error) {
    throw lastParseError;
  }
  const mapped = mapGeminiError(lastError);
  throw new Error(mapped.message);
}
