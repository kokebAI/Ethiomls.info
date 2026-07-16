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
};

const CLUSTER_IDS = SUB_CITY_CLUSTERS.map((c) => c.id);
const INTENT_IDS = ["buy", "rent", "off_plan"] as const;
const CURRENCIES = ["ETB", "USD"] as const;

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

Allowed budgetCurrency: ETB or USD
budgetAmount must be a positive number (monthly for rent, purchase target for buy/off_plan).

Respond with ONLY valid JSON (no markdown), shape:
{
  "intent": "buy" | "rent" | "off_plan",
  "clusterId": "central" | "east" | "west" | "south",
  "budgetAmount": number,
  "budgetCurrency": "ETB" | "USD",
  "summary": "one short sentence in the user's language confirming understanding"
}

User request:
"""${query.trim().slice(0, 800)}"""`;
}

function isClusterId(value: unknown): value is SubCityClusterId {
  return typeof value === "string" && CLUSTER_IDS.includes(value as SubCityClusterId);
}

function isIntent(value: unknown): value is SearchIntent {
  return typeof value === "string" && (INTENT_IDS as readonly string[]).includes(value);
}

function isCurrency(value: unknown): value is BudgetCurrency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
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

export function normalizeSearchAssist(raw: Record<string, unknown>): SearchAssistResult {
  if (!isIntent(raw.intent)) {
    throw new Error("Invalid intent from model");
  }
  if (!isClusterId(raw.clusterId)) {
    throw new Error("Invalid clusterId from model");
  }
  if (!isCurrency(raw.budgetCurrency)) {
    throw new Error("Invalid budgetCurrency from model");
  }

  const amount = Number(raw.budgetAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid budgetAmount from model");
  }

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim().slice(0, 280)
      : "Search preferences understood.";

  return {
    intent: raw.intent,
    clusterId: raw.clusterId,
    budgetAmount: amount,
    budgetCurrency: raw.budgetCurrency,
    summary,
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
          temperature: 0.2,
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
      // Keep trying other models — some AQ.* projects admit only 2.0-lite.
      if (mapped.code === "AiInvalidKey") {
        throw new Error(mapped.message);
      }
      console.warn(`[search-assist] model ${model} failed:`, mapped.message);
    }
  }

  const mapped = mapGeminiError(lastError);
  throw new Error(mapped.message);
}
