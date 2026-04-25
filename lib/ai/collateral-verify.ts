import { z } from "zod";
import { generateObject } from "ai";
import { mistral, MODEL_LARGE } from "@/lib/ai/client";
import type { CollateralRow } from "@/lib/db";

export const CollateralVerdictSchema = z.object({
  documentRecognised: z
    .boolean()
    .describe("Could the AI identify what kind of document this is?"),
  documentType: z
    .string()
    .nullable()
    .describe(
      "What the document looks like (e.g. 'commercial lease', 'invoice', 'bank statement', 'equipment receipt')"
    ),
  matchesClaim: z
    .enum(["yes", "partial", "no", "unclear"])
    .describe("Does the document match the founder's collateral claim?"),
  valuePlausible: z
    .enum(["yes", "ambiguous", "no", "unclear"])
    .describe("Is the declared value plausible given the document?"),
  redFlags: z
    .array(z.string())
    .describe("Concrete red flags. Empty array if none."),
  summary: z
    .string()
    .min(40)
    .max(500)
    .describe("2-3 sentence verdict summary an investor can read."),
  confidenceScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "0-100 confidence in this verification. 80+ = strong evidence, 40-80 = some signals, below = thin/unclear."
    ),
});
export type CollateralVerdict = z.infer<typeof CollateralVerdictSchema>;

const SYSTEM_PROMPT = `You are an asset-verification analyst at a small-business lending desk. You receive:
- A collateral type and description provided by the founder
- A declared value in EUR
- The text content extracted from an uploaded document (may be partial, may be empty if extraction failed, may be a non-text file)

Your job: produce a verdict for an investor. Be strict but fair.

Rules:
- documentRecognised: true if the text looks like a real document (not gibberish or empty).
- documentType: short label of what kind of doc you see (or null if unclear).
- matchesClaim: does the doc actually back up the founder's stated collateral?
  - "yes" only if the document clearly evidences the asset.
  - "partial" if it mentions related context but not the specific asset.
  - "no" if it's about something else.
  - "unclear" if there isn't enough text to tell.
- valuePlausible: based on the doc, is the declared value reasonable?
  - "yes" only if the document shows a number/value consistent with the claim.
  - "ambiguous" if there's no number to compare.
  - "no" if the document suggests a very different value.
  - "unclear" for empty/garbled extraction.
- redFlags: only put concrete, evidence-backed concerns. Don't speculate. Empty array is fine.
- summary: 2-3 plain-English sentences a busy investor reads first.
- confidenceScore: 80+ only if you have strong textual evidence. 40-80 if some signals. <40 if extraction failed or document is unrecognisable.

If the extracted text is empty or marked as failed extraction, set documentRecognised=false, matchesClaim="unclear", valuePlausible="unclear", and put a confidenceScore under 30 with a summary like "Could not read the uploaded document. Manual review required."

Don't invent. Don't be overly generous. Investors rely on this.`;

export type VerifyInput = {
  collateral: Pick<
    CollateralRow,
    "type" | "description" | "declared_value_eur" | "document_filename"
  >;
  documentText: string;
  documentExtractOk: boolean;
};

export async function verifyCollateral(
  input: VerifyInput
): Promise<CollateralVerdict> {
  const prompt = [
    "Founder's claim:",
    `- Type: ${input.collateral.type}`,
    `- Description: ${input.collateral.description}`,
    `- Declared value: €${input.collateral.declared_value_eur}`,
    `- Uploaded file: ${input.collateral.document_filename ?? "(none)"}`,
    "",
    `Document extraction status: ${input.documentExtractOk ? "ok" : "failed/empty"}`,
    "",
    "Document text content:",
    input.documentText
      ? "```\n" + input.documentText.slice(0, 30_000) + "\n```"
      : "(empty/no text)",
  ].join("\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await generateObject({
        model: mistral(MODEL_LARGE),
        schema: CollateralVerdictSchema,
        system: SYSTEM_PROMPT,
        prompt,
        temperature: 0,
      });
      return r.object;
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
  throw new Error("unreachable");
}
