import { createMistral } from "@ai-sdk/mistral";

export const mistral = createMistral({
  apiKey: process.env.MISTRAL_API_KEY!,
});

export const MODEL_LARGE = "mistral-large-latest";
export const MODEL_SMALL = "mistral-small-latest";
