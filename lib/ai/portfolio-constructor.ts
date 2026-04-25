import { z } from "zod";
import { generateObject } from "ai";
import { mistral, MODEL_LARGE } from "@/lib/ai/client";
import type { CampaignWithCompany } from "@/lib/db";

export const PortfolioInputSchema = z.object({
  totalCapital: z.number().int().min(10_000),
  sectors: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  stagePreference: z.enum(["any", "pre_revenue", "early", "growth"]).optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).default("medium"),
  maxPositions: z.number().int().min(3).max(25).default(12),
  thesisText: z.string().max(1000).optional(),
});
export type PortfolioInput = z.infer<typeof PortfolioInputSchema>;

const PositionSchema = z.object({
  campaignId: z
    .string()
    .describe("ID of the campaign from the candidate list"),
  allocationEur: z
    .number()
    .int()
    .min(1000)
    .describe("Allocation in whole euros"),
  rationale: z
    .string()
    .min(20)
    .max(280)
    .describe("One sentence tying the pick to the thesis or fit signals"),
});

export const PortfolioOutputSchema = z.object({
  positions: z.array(PositionSchema).min(1).max(25),
  expectedRiskProfile: z.enum(["low", "medium", "high"]),
});
export type PortfolioOutput = z.infer<typeof PortfolioOutputSchema>;

export type Diversification = {
  bySector: Record<string, number>;
  byCountry: Record<string, number>;
  byStage: Record<string, number>;
};

export type FinalPosition = z.infer<typeof PositionSchema> & {
  allocationPct: number;
  campaign: CampaignWithCompany;
};

export type PortfolioResult = {
  positions: FinalPosition[];
  diversification: Diversification;
  expectedRiskProfile: "low" | "medium" | "high";
  totalDeployed: number;
  totalRequested: number;
};

const SYSTEM_PROMPT = `You are an associate building a first-pass portfolio for an investor in European non-tech SMBs. You have the investor's constraints and a list of pre-filtered candidate campaigns (each tied to one company), with a fit score.

Pick the best subset and allocate the investor's total capital across them.

Hard rules:
- Sum of allocations must equal total capital, give or take €1000.
- No single campaign gets more than 25% of total capital.
- An allocation must not exceed the campaign's capital_seeking_eur — don't oversize their round.
- Each candidate campaign ID appears AT MOST ONCE in your output. No duplicate rows.
- Pick at least 5, at most maxPositions (or fewer if candidates are limited).
- Diversify across sectors and countries when possible.

Soft preferences:
- Prefer higher fit-score candidates.
- Match the investor's stagePreference unless diversification calls for otherwise.
- Risk tolerance: low → growth + profitable, medium → balanced, high → can include pre_revenue.
- Rationale should reference the thesis or specific signals (sector match, FR-only thesis, MRR profile, etc.).

Output:
- positions: array of {campaignId, allocationEur (whole EUR), rationale (1 sentence)}.
- expectedRiskProfile: low/medium/high based on the mix you actually chose.`;

export type Candidate = {
  campaign: CampaignWithCompany;
  fitScore: number;
  fitSignals: string[];
};

export function rankCandidates(
  campaigns: CampaignWithCompany[],
  input: PortfolioInput
): Candidate[] {
  return campaigns
    .map((camp) => {
      const co = camp.company;
      const signals: string[] = [];
      let score = 0;

      if (input.sectors?.length && co.sector && input.sectors.includes(co.sector)) {
        score += 25;
        signals.push("sector match");
      }
      if (
        input.countries?.length &&
        co.country &&
        input.countries.includes(co.country)
      ) {
        score += 20;
        signals.push("country match");
      }
      if (
        input.stagePreference &&
        input.stagePreference !== "any" &&
        co.stage === input.stagePreference
      ) {
        score += 15;
        signals.push("stage match");
      }
      if (camp.capital_seeking_eur > 0) {
        const fraction = camp.capital_seeking_eur / input.totalCapital;
        if (fraction > 0.001 && fraction <= 0.25) {
          score += 10;
          signals.push("ticket fits");
        }
      }
      if (input.riskTolerance === "low" && co.stage === "growth") {
        score += 8;
        signals.push("low-risk preference");
      }
      if (
        input.riskTolerance === "low" &&
        co.monthly_revenue_eur != null &&
        co.monthly_revenue_eur >= (co.monthly_burn_eur ?? Infinity)
      ) {
        score += 7;
        signals.push("profitable");
      }
      if (input.riskTolerance === "high" && co.stage === "pre_revenue") {
        score += 5;
        signals.push("high-risk acceptable");
      }
      if (co.monthly_revenue_eur && co.monthly_revenue_eur > 0) {
        score += 5;
        signals.push("has revenue");
      }

      return { campaign: camp, fitScore: score, fitSignals: signals };
    })
    .sort((a, b) => b.fitScore - a.fitScore);
}

export async function runConstructor(
  input: PortfolioInput,
  candidates: Candidate[]
): Promise<PortfolioOutput> {
  if (!candidates.length) {
    throw new Error("No candidates passing hard filters");
  }

  const top = candidates.slice(0, 30);
  const candidatesNote = top
    .map((c) => {
      const co = c.campaign.company;
      return `- ${c.campaign.id} | ${co.name} (${co.country ?? "-"}, ${co.sector ?? "-"}, ${co.stage ?? "-"}) | "${c.campaign.title}" | seeking €${c.campaign.capital_seeking_eur} | MRR ${co.monthly_revenue_eur ?? "n/a"} | team ${co.team_size ?? "?"} | fit ${c.fitScore} (${c.fitSignals.join(", ") || "—"})`;
    })
    .join("\n");

  const prompt = [
    "Investor constraints:",
    `- Total capital: €${input.totalCapital}`,
    `- Risk tolerance: ${input.riskTolerance}`,
    `- Stage preference: ${input.stagePreference ?? "any"}`,
    `- Sectors filter: ${input.sectors?.join(", ") || "any"}`,
    `- Countries filter: ${input.countries?.join(", ") || "any"}`,
    `- Max positions: ${input.maxPositions}`,
    `- Free thesis: ${input.thesisText || "(none provided)"}`,
    "",
    `Candidate campaigns (${top.length} after hard filter, sorted by fit score):`,
    candidatesNote,
  ].join("\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await generateObject({
        model: mistral(MODEL_LARGE),
        schema: PortfolioOutputSchema,
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

export function computeDiversification(
  positions: FinalPosition[]
): Diversification {
  const bySector: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  for (const p of positions) {
    const co = p.campaign.company;
    bucket(bySector, co.sector ?? "unknown", p.allocationEur);
    bucket(byCountry, co.country ?? "unknown", p.allocationEur);
    bucket(byStage, co.stage ?? "unknown", p.allocationEur);
  }
  return { bySector, byCountry, byStage };
}

function bucket(
  acc: Record<string, number>,
  key: string,
  value: number
): void {
  acc[key] = (acc[key] ?? 0) + value;
}
