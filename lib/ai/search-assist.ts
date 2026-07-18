import { Type } from "@google/genai";
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

const DEFAULT_BUDGET_ETB: Record<SearchIntent, number> = {
  rent: 25_000,
  buy: 5_000_000,
  off_plan: 8_000_000,
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING },
    clusterId: { type: Type.STRING },
    budgetAmount: { type: Type.NUMBER },
    budgetCurrency: { type: Type.STRING },
    minCompletionPercent: { type: Type.NUMBER },
    summary: { type: Type.STRING },
  },
  required: ["intent", "clusterId", "budgetAmount", "budgetCurrency", "summary"],
};

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

Money rules (critical):
- budgetCurrency must be exactly "ETB" or "USD". Prefer ETB.
- budgetAmount must be a JSON number (digits only). Examples: 25000, 5000000.
- Never return null/empty for budgetAmount. If the user did not state a budget, estimate a typical Addis Ababa figure (rent ~25000 ETB/month, buy ~5000000 ETB, off_plan ~8000000 ETB).
- Convert phrases like "5 million" to 5000000.

For off_plan, set minCompletionPercent to 0, 25, 50, 80, or 100 when mentioned; otherwise 0.

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

function coerceCurrency(value: unknown, query?: string): BudgetCurrency {
  const blob = `${value ?? ""} ${query ?? ""}`.toLowerCase();
  if (
    blob.includes("usd") ||
    blob.includes("dollar") ||
    blob.includes("$") ||
    blob.includes("ዶላር")
  ) {
    return "USD";
  }
  return "ETB";
}

/** Parse model money fields that often come back as strings like "5 million". */
export function coerceBudgetAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const nested =
      coerceBudgetAmount(obj.amount) ??
      coerceBudgetAmount(obj.value) ??
      coerceBudgetAmount(obj.budget);
    if (nested != null) {
      const unit = String(obj.unit ?? obj.scale ?? "").toLowerCase();
      if (unit.includes("million") || unit === "m") return nested * 1_000_000;
      if (unit.includes("thousand") || unit === "k") return nested * 1_000;
      return nested;
    }
  }
  if (typeof value !== "string") return null;

  const raw = value
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\u00a0/g, " ");
  if (!raw || raw === "null" || raw === "undefined" || raw === "n/a") {
    return null;
  }

  const match = raw.match(
    /(\d+(?:\.\d+)?)\s*(k|m|mn|million|billion|bn|thousand|ሺ|ሚሊየን)?/u,
  );
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base) || base <= 0) return null;
  const unit = match[2] ?? "";
  if (unit === "k" || unit === "thousand" || unit === "ሺ") return base * 1_000;
  if (
    unit === "m" ||
    unit === "mn" ||
    unit === "million" ||
    unit === "ሚሊየን"
  ) {
    return base * 1_000_000;
  }
  if (unit === "billion" || unit === "bn") return base * 1_000_000_000;
  return base;
}

function inferBudgetFromQuery(
  query: string,
  intent: SearchIntent,
): number | null {
  const fromText = coerceBudgetAmount(query);
  if (fromText != null) {
    // Heuristic: bare "5" in a buy query usually means 5 million ETB.
    if (fromText < 100 && (intent === "buy" || intent === "off_plan")) {
      return fromText * 1_000_000;
    }
    if (fromText < 1000 && intent === "rent") {
      return fromText * 1_000;
    }
    return fromText;
  }
  return null;
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
  opts?: { query?: string },
): SearchAssistResult {
  const query = opts?.query ?? "";
  const intent =
    coerceIntent(raw.intent) ??
    coerceIntent(query) ??
    ("buy" as SearchIntent);

  const clusterId =
    coerceClusterId(raw.clusterId) ??
    coerceClusterId(query) ??
    ("central" as SubCityClusterId);

  const budgetCurrency = coerceCurrency(
    raw.budgetCurrency ?? raw.currency ?? raw.budget_currency,
    query,
  );

  const amount =
    coerceBudgetAmount(
      raw.budgetAmount ?? raw.budget ?? raw.amount ?? raw.budget_amount,
    ) ??
    inferBudgetFromQuery(query, intent) ??
    DEFAULT_BUDGET_ETB[intent];

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

  for (const model of GEMINI_MODEL_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const text = response.text;
      if (!text?.trim()) {
        throw new Error(`Empty model response from ${model}`);
      }

      const parsed = parseJsonObject(text);
      return normalizeSearchAssist(parsed, { query });
    } catch (error) {
      lastError = error;
      const mapped = mapGeminiError(error);
      if (mapped.code === "AiInvalidKey" || mapped.code === "AiPermissionDenied") {
        throw new Error(mapped.message);
      }
      console.warn(
        `[search-assist] model ${model} failed:`,
        mapped.message,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Last resort: fill from the query alone so guided search still works.
  try {
    return normalizeSearchAssist({}, { query });
  } catch {
    const mapped = mapGeminiError(lastError);
    throw new Error(mapped.message);
  }
}
