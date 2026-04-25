import { z } from "zod";
import { generateObject } from "ai";
import { mistral, MODEL_LARGE } from "@/lib/ai/client";
import type { LLMEnrichKind } from "@/lib/onboarding/types";

/**
 * One unified output shape for any field-level LLM enrichment.
 * `enriched` is the user-facing reformulation, `rationale` is a short note
 * explaining the choices, and `extracted` is structured side data (filters,
 * tags) that callers may apply to OTHER form fields.
 */
const EnrichResponseSchema = z.object({
  enriched: z.string().min(1),
  rationale: z.string().nullable(),
  extracted: z
    .object({
      sectors: z.array(z.string()).nullable(),
      countries: z.array(z.string()).nullable(),
      keywords: z.array(z.string()).nullable(),
      summary: z.string().nullable(),
    })
    .nullable(),
});

export type EnrichResponse = z.infer<typeof EnrichResponseSchema>;

const PROMPTS: Record<LLMEnrichKind, { system: string; userPrefix: string }> = {
  smb_activity_description: {
    system: `You polish a French SMB founder's raw description of their business into a clear, neutral 2-3 sentence pitch suitable for a credit / financing review. Keep it factual, no marketing fluff. Match the original language (French if input is French). Set "extracted.keywords" to 3-5 short tags describing the business.`,
    userPrefix:
      "Description brute du fondateur (à reformuler en 2-3 phrases factuelles, en français) :",
  },
  smb_need_description: {
    system: `You polish a French SMB founder's raw explanation of their short-term financing need into a clear, neutral 2-3 sentence statement aimed at a lender. Keep all numbers exactly as given. Mention what the funds will be used for and why now. Match the original language. "extracted.summary" should be a one-line tldr.`,
    userPrefix:
      "Besoin de financement décrit par le fondateur (à reformuler pour un prêteur, en français) :",
  },
  smb_seasonality_note: {
    system: `You compress a free-form note about seasonality into one neutral sentence in the user's language, naming peaks and troughs if mentioned. No padding.`,
    userPrefix: "Note brute sur la saisonnalité :",
  },
  investor_thesis: {
    system: `You take an investor's free-form short-term-credit thesis and produce: (a) a polished 2-3 sentence version in the user's language, and (b) extracted filters where confident: sectors (one of: b2b_services, agency, saas_micro, makers, retail, manufacturing, professional_services, ecommerce), countries (ISO-2 codes), keywords (3-5 short tags). Only include filters explicitly implied by the text. Leave others null.`,
    userPrefix: "Thèse brute de l'investisseur :",
  },
  investor_exclusions: {
    system: `You read an investor's free-form exclusion text and produce: (a) a clean one-sentence summary, (b) extracted "sectors" they want to exclude (subset of: b2b_services, agency, saas_micro, makers, retail, manufacturing, professional_services, ecommerce), "countries" (ISO-2) they want to exclude, and "keywords" capturing the rest. Only fill what's explicit.`,
    userPrefix: "Exclusions brutes :",
  },
};

export async function enrichField(opts: {
  kind: LLMEnrichKind;
  raw: string;
  context?: Record<string, unknown>;
}): Promise<EnrichResponse> {
  const cfg = PROMPTS[opts.kind];
  const contextBlock = opts.context
    ? `\n\nProfil partiel déjà connu :\n${JSON.stringify(opts.context, null, 2)}`
    : "";

  const result = await generateObject({
    model: mistral(MODEL_LARGE),
    schema: EnrichResponseSchema,
    system: cfg.system,
    prompt: `${cfg.userPrefix}\n\n"""${opts.raw}"""${contextBlock}`,
    temperature: 0.2,
  });
  return result.object;
}
