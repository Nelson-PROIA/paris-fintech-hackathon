import { createMistral } from "@ai-sdk/mistral";
import { createCerebras } from "@ai-sdk/cerebras";
import type { LanguageModel } from "ai";

export const mistral = createMistral({
  apiKey: process.env.MISTRAL_API_KEY!,
});

const _cerebrasKey = process.env.CEREBRAS_API_KEY;
export const cerebras = _cerebrasKey
  ? createCerebras({ apiKey: _cerebrasKey })
  : null;

export const MODEL_LARGE = "mistral-large-latest";
export const MODEL_SMALL = "mistral-small-latest";
export const CEREBRAS_FALLBACK_MODEL = "llama-3.3-70b";

export function primaryModel(): LanguageModel {
  return mistral(MODEL_LARGE);
}

export function fallbackModel(): LanguageModel | null {
  if (!cerebras) return null;
  return cerebras(CEREBRAS_FALLBACK_MODEL);
}

/**
 * Run an AI-SDK call with automatic Cerebras fallback if Mistral throws.
 * Use for non-streaming calls (generateObject, generateText).
 *
 * @example
 * const r = await withModelFallback((model) =>
 *   generateObject({ model, schema, prompt, system, temperature: 0 })
 * );
 */
export async function withModelFallback<T>(
  spec: (model: LanguageModel) => Promise<T>
): Promise<T> {
  try {
    return await spec(primaryModel());
  } catch (e) {
    const fb = fallbackModel();
    if (!fb) throw e;
    console.warn(
      "[ai] Mistral call failed, falling back to Cerebras:",
      e instanceof Error ? e.message : String(e)
    );
    return await spec(fb);
  }
}
