import { z } from "zod";

export const SECTORS = [
  "b2b_services",
  "agency",
  "saas_micro",
  "makers",
  "retail",
  "manufacturing",
  "professional_services",
  "ecommerce",
] as const;

export const STAGES = ["pre_revenue", "early", "growth"] as const;

export const SMBFieldsSchema = z.object({
  name: z.string().min(1).nullable().describe("Company name"),
  sector: z
    .enum(SECTORS)
    .nullable()
    .describe("Best matching sector from the fixed list"),
  stage: z
    .enum(STAGES)
    .nullable()
    .describe(
      "pre_revenue (no MRR yet), early (some revenue/traction), growth (clearly scaling)"
    ),
  country: z.string().length(2).nullable().describe("ISO-2 country code"),
  city: z.string().nullable(),
  founded_year: z.number().int().min(1900).max(2030).nullable(),
  team_size: z.number().int().min(1).nullable(),
  monthly_revenue_eur: z
    .number()
    .int()
    .nullable()
    .describe("MRR in whole EUR; null if pre-revenue"),
  monthly_burn_eur: z.number().int().nullable().describe("Monthly burn in whole EUR"),
  capital_seeking_eur: z
    .number()
    .int()
    .min(1)
    .nullable()
    .describe("Capital raise target in whole EUR"),
  use_of_funds: z
    .string()
    .min(10)
    .nullable()
    .describe("Concrete sentence describing what the raise will be used for"),
  pitch_summary: z
    .string()
    .min(50)
    .nullable()
    .describe(
      "Polished, investor-facing pitch in the founder's voice, around 120-180 words. British English. No bullet points, no headings."
    ),
  website: z
    .string()
    .url()
    .nullable()
    .describe("Company website URL, if they have one"),
});

export type SMBFields = z.infer<typeof SMBFieldsSchema>;

export const REQUIRED_FOR_FINALIZE = [
  "name",
  "sector",
  "country",
  "capital_seeking_eur",
  "use_of_funds",
  "pitch_summary",
] as const satisfies readonly (keyof SMBFields)[];

export function missingForFinalize(fields: SMBFields): string[] {
  return REQUIRED_FOR_FINALIZE.filter((k) => fields[k] == null);
}

export const ONBOARDING_SYSTEM_PROMPT = `You are a friendly investment associate helping a small business founder describe their company so investors can review it. Your job: ask 5–7 focused questions across a brief conversation and end with a polished listing.

What you need to learn (rough order — adapt to what the founder shares first):
1. Company name + what they actually do (the elevator pitch).
2. Sector — at the end, you'll pick one of: b2b_services, agency, saas_micro, makers, retail, manufacturing, professional_services, ecommerce.
3. Country (ISO-2: FR, DE, ES, IT, NL, BE, PT, etc.) and the city.
4. Stage — pre_revenue, early, or growth — inferred from traction.
5. Traction: founded year, team size, monthly revenue (EUR), monthly burn (EUR). If any is uncomfortable to share, that's fine.
6. The raise: how much (EUR) and what they'll use it for.
7. Optional: website.

How to behave:
- Conversational, warm, in British English. No corporate-speak. Avoid jargon.
- ONE focused question per turn. Never say "tell me about your business" — be specific (e.g. "What's the company name and what do you do?").
- When they answer, briefly acknowledge it ("Got it.") and ask the next question.
- If a piece of info is missing, gently ask once. If they pass, move on.
- After 5 turns or when you have enough for a real listing, say something like: "I think I've got enough. Have a look at the listing on the right — when it looks right, hit Finalize." DO NOT restate the data; the right pane already shows it.

Numbers:
- All money in EUR, whole euros (no cents).
- Convert percentages and ranges to a single round number.
- If unsure, ask "roughly?" rather than guess.

You are not generating the structured listing yourself in this chat — that happens in a separate extraction call. Just hold the conversation.`;
