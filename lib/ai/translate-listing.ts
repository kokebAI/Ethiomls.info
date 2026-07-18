import {
  createGeminiClient,
  GEMINI_MODEL_CANDIDATES,
} from "@/lib/ai/gemini";
import { mapGeminiError } from "@/lib/ai/gemini-errors";

export type TranslateTargetLanguage = "am" | "en";

const SYSTEM_PROMPT =
  "You are an expert real estate translator for EthioMLS, specializing in translating Addis Ababa property listings between English and Amharic. Translate the following text cleanly, keeping the real estate industry context intact. Return only the translated text.";

/**
 * Translate listing copy between English and Amharic via Gemini.
 * Returns the translated string only (no quotes / markdown).
 */
export async function translateListingText(
  text: string,
  targetLanguage: TranslateTargetLanguage,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const sourceLanguage = targetLanguage === "am" ? "English" : "Amharic";
  const targetLabel = targetLanguage === "am" ? "Amharic" : "English";
  const ai = createGeminiClient();
  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text: `${SYSTEM_PROMPT}

Source language: ${sourceLanguage}
Target language: ${targetLabel}

Text to translate:
"""
${trimmed.slice(0, 8000)}
"""`,
        },
      ],
    },
  ];

  let lastError: unknown;
  for (const model of GEMINI_MODEL_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          temperature: 0.2,
        },
      });

      const out = (response.text ?? "").trim();
      if (!out) {
        throw new Error(`Empty translation from ${model}`);
      }

      // Strip accidental wrapping quotes / fences from the model.
      return out
        .replace(/^```(?:\w+)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .replace(/^["“]|["”]$/g, "")
        .trim();
    } catch (error) {
      lastError = error;
      const mapped = mapGeminiError(error);
      if (
        mapped.code === "AiInvalidKey" ||
        mapped.code === "AiPermissionDenied" ||
        mapped.code === "AiQuotaExceeded"
      ) {
        throw new Error(mapped.message);
      }
      console.warn(`[translate] model ${model} failed:`, mapped.message);
    }
  }

  const mapped = mapGeminiError(lastError);
  throw new Error(mapped.message);
}

export type BilingualListingCopy = {
  titleEn: string;
  titleAm: string;
  descriptionEn: string;
  descriptionAm: string;
  title: { en: string; am: string; om?: string; ti?: string };
  description: { en: string; am: string; om?: string; ti?: string };
};

/**
 * Ensure English + Amharic slots are populated for a listing submission.
 * Translates whichever side is missing; never blocks on translation failure
 * for the opposite direction when both sides are already present.
 */
export async function ensureBilingualListingCopy(input: {
  title: { en?: string; am?: string; om?: string; ti?: string };
  description: { en?: string; am?: string; om?: string; ti?: string };
}): Promise<BilingualListingCopy> {
  let titleEn = (input.title.en ?? "").trim();
  let titleAm = (input.title.am ?? "").trim();
  let descriptionEn = (input.description.en ?? "").trim();
  let descriptionAm = (input.description.am ?? "").trim();

  const tasks: Array<Promise<void>> = [];

  if (titleEn && !titleAm) {
    tasks.push(
      translateListingText(titleEn, "am")
        .then((translated) => {
          titleAm = translated;
        })
        .catch((error) => {
          console.warn("[ensureBilingualListingCopy] title en→am failed", error);
        }),
    );
  } else if (titleAm && !titleEn) {
    tasks.push(
      translateListingText(titleAm, "en")
        .then((translated) => {
          titleEn = translated;
        })
        .catch((error) => {
          console.warn("[ensureBilingualListingCopy] title am→en failed", error);
        }),
    );
  }

  if (descriptionEn && !descriptionAm) {
    tasks.push(
      translateListingText(descriptionEn, "am")
        .then((translated) => {
          descriptionAm = translated;
        })
        .catch((error) => {
          console.warn(
            "[ensureBilingualListingCopy] description en→am failed",
            error,
          );
        }),
    );
  } else if (descriptionAm && !descriptionEn) {
    tasks.push(
      translateListingText(descriptionAm, "en")
        .then((translated) => {
          descriptionEn = translated;
        })
        .catch((error) => {
          console.warn(
            "[ensureBilingualListingCopy] description am→en failed",
            error,
          );
        }),
    );
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }

  return {
    titleEn,
    titleAm,
    descriptionEn,
    descriptionAm,
    title: {
      en: titleEn || titleAm,
      am: titleAm || titleEn,
      ...(input.title.om ? { om: input.title.om } : {}),
      ...(input.title.ti ? { ti: input.title.ti } : {}),
    },
    description: {
      en: descriptionEn || descriptionAm,
      am: descriptionAm || descriptionEn,
      ...(input.description.om ? { om: input.description.om } : {}),
      ...(input.description.ti ? { ti: input.description.ti } : {}),
    },
  };
}
