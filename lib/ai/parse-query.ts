import { z } from "zod";
import { generateObject } from "ai";
import { withModelFallback } from "@/lib/ai/client";

export const PortfolioFilterParseSchema = z.object({
  totalCapital: z
    .number()
    .int()
    .min(1000)
    .nullable()
    .describe("Total capital in whole EUR"),
  sectors: z.array(z.string()).nullable().describe("From the allowed list"),
  countries: z.array(z.string()).nullable().describe("ISO-2 codes from the allowed list"),
  stagePreference: z
    .enum(["any", "pre_revenue", "early", "growth"])
    .nullable(),
  riskTolerance: z.enum(["low", "medium", "high"]).nullable(),
  maxPositions: z.number().int().min(3).max(25).nullable(),
  thesisText: z
    .string()
    .nullable()
    .describe(
      "Short free-form thesis capturing extra context not covered by other fields"
    ),
});
export type PortfolioFilterParse = z.infer<typeof PortfolioFilterParseSchema>;

export const FeedFilterParseSchema = z.object({
  sectors: z.array(z.string()).nullable(),
  countries: z.array(z.string()).nullable(),
  ticketMin: z.number().int().min(0).nullable(),
  ticketMax: z.number().int().min(0).nullable(),
});
export type FeedFilterParse = z.infer<typeof FeedFilterParseSchema>;

const MAPPING_NOTES = `Mapping notes for sectors:
- "SaaS" / "software" / "tools" → "saas_micro"
- "consulting" / "advisory" / "accounting" → "professional_services"
- "agency" / "creative" / "design firm" → "agency"
- "factory" / "production" / "industrial" → "manufacturing"
- "artisan" / "craftspeople" / "workshop" / "atelier" → "makers"
- "online store" / "DTC" / "D2C" → "ecommerce"
- "shop" / "store" / "café" / "restaurant" → "retail"
- "B2B" / "service business" → "b2b_services"

For risk tolerance: "low risk"/"safe"/"profitable companies" → low. "aggressive"/"high risk"/"high upside" → high. Otherwise medium.

For money: parse "€2M" as 2000000, "€500k" as 500000, "200 thousand" as 200000.

Set fields to null when not mentioned. Don't invent.`;

export async function parsePortfolioQuery(
  text: string,
  allowedSectors: string[],
  allowedCountries: string[]
): Promise<PortfolioFilterParse> {
  const r = await withModelFallback((model) =>
    generateObject({
      model,
      schema: PortfolioFilterParseSchema,
      system: `You are parsing an investor's plain-language portfolio request into structured filter values.

Allowed sectors (use ONLY these strings, lowercase exact): ${allowedSectors.join(", ")}
Allowed country codes (ISO-2 only): ${allowedCountries.join(", ")}

${MAPPING_NOTES}`,
      prompt: text.slice(0, 1000),
      temperature: 0,
      maxRetries: 3,
    })
  );
  return r.object;
}

export async function parseFeedQuery(
  text: string,
  allowedSectors: string[],
  allowedCountries: string[]
): Promise<FeedFilterParse> {
  const r = await withModelFallback((model) =>
    generateObject({
      model,
      schema: FeedFilterParseSchema,
      system: `You are parsing a plain-language deal-browse query into structured filter values.

Allowed sectors (use ONLY these strings, lowercase exact): ${allowedSectors.join(", ")}
Allowed country codes (ISO-2 only): ${allowedCountries.join(", ")}

${MAPPING_NOTES}

For ticket range: "tickets up to €200k" → ticketMax 200000. "at least €100k" → ticketMin 100000. "between €100k and €500k" → both.`,
      prompt: text.slice(0, 1000),
      temperature: 0,
      maxRetries: 3,
    })
  );
  return r.object;
}
