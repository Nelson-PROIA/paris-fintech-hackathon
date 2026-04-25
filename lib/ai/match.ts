import { z } from "zod";
import { generateObject, streamObject } from "ai";
import { mistral, MODEL_LARGE, withModelFallback } from "@/lib/ai/client";
import type { CampaignWithCompany, InvestorRow } from "@/lib/db";

const MatchedItemSchema = z.object({
  campaignId: z.string(),
  fitScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0-100 fit against the investor's thesis"),
  reasoning: z
    .string()
    .min(20)
    .max(220)
    .describe("One-sentence why this matches"),
});

export const MatchResultSchema = z.object({
  matches: z.array(MatchedItemSchema).min(0).max(10),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

export type MatchedItem = z.infer<typeof MatchedItemSchema>;

export type MatchedItemHydrated = MatchedItem & {
  campaign: CampaignWithCompany;
};

const SYSTEM_PROMPT = `You are an investment associate building a curated weekly digest for a specific investor.

Given:
- The investor's full thesis (sectors, countries, stages, ticket range, total capital, risk tolerance, free-text description)
- A list of pre-filtered candidate campaigns

Pick at most 10 campaigns that best match the thesis and rank them. For each, write ONE sentence of reasoning that ties the pick to specific thesis elements (sector, country, stage, ticket fit, traction signals).

Be honest:
- If a campaign matches the sectors but ticket is way over the investor's max, skip it.
- If only 4 candidates make sense, return only 4.
- Prefer corroborated traction over claims.
- fitScore is 0-100. 80+ = "perfect match". 60-80 = "strong fit". 40-60 = "marginal". Below = don't include.`;

export async function runMatch(
  investor: InvestorRow,
  candidates: CampaignWithCompany[]
): Promise<MatchResult> {
  if (!candidates.length) return { matches: [] };

  const sectors = investor.sectors_json
    ? (JSON.parse(investor.sectors_json) as string[])
    : [];
  const countries = investor.countries_json
    ? (JSON.parse(investor.countries_json) as string[])
    : [];
  const stages = investor.stages_json
    ? (JSON.parse(investor.stages_json) as string[])
    : [];

  const top = candidates.slice(0, 30);
  const candidatesNote = top
    .map((c) => {
      const co = c.company;
      return `- ${c.id} | ${co.name} (${co.country ?? "-"}, ${co.sector ?? "-"}, ${co.stage ?? "-"}) | "${c.title}" | seeking €${c.capital_seeking_eur} | MRR ${co.monthly_revenue_eur ?? "n/a"} | team ${co.team_size ?? "?"}`;
    })
    .join("\n");

  const prompt = [
    "Investor thesis:",
    `- Display name: ${investor.display_name}`,
    `- Sectors: ${sectors.join(", ") || "any"}`,
    `- Countries: ${countries.join(", ") || "any"}`,
    `- Stages: ${stages.join(", ") || "any"}`,
    `- Ticket range: ${investor.ticket_min_eur ?? "?"}–${investor.ticket_max_eur ?? "?"} EUR`,
    `- Total capital: ${investor.total_capital_eur ?? "n/a"} EUR`,
    `- Risk tolerance: ${investor.risk_tolerance ?? "medium"}`,
    `- Free thesis: ${investor.thesis_text ?? "(none)"}`,
    "",
    `Candidate campaigns (${top.length}):`,
    candidatesNote,
  ].join("\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await withModelFallback((model) =>
        generateObject({
          model,
          schema: MatchResultSchema,
          system: SYSTEM_PROMPT,
          prompt,
          temperature: 0,
          maxRetries: 3,
        })
      );
      return r.object;
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
  throw new Error("unreachable");
}

/**
 * Streaming variant: emits each fully-formed match as Mistral produces it.
 * Returns the final list once the stream completes.
 */
export async function streamMatchItems(
  investor: InvestorRow,
  candidates: CampaignWithCompany[],
  onItem: (item: MatchedItem) => void
): Promise<MatchedItem[]> {
  if (!candidates.length) return [];

  const sectors = investor.sectors_json
    ? (JSON.parse(investor.sectors_json) as string[])
    : [];
  const countries = investor.countries_json
    ? (JSON.parse(investor.countries_json) as string[])
    : [];
  const stages = investor.stages_json
    ? (JSON.parse(investor.stages_json) as string[])
    : [];

  const top = candidates.slice(0, 30);
  const candidatesNote = top
    .map((c) => {
      const co = c.company;
      return `- ${c.id} | ${co.name} (${co.country ?? "-"}, ${co.sector ?? "-"}, ${co.stage ?? "-"}) | "${c.title}" | seeking €${c.capital_seeking_eur} | MRR ${co.monthly_revenue_eur ?? "n/a"} | team ${co.team_size ?? "?"}`;
    })
    .join("\n");

  const prompt = [
    "Investor thesis:",
    `- Display name: ${investor.display_name}`,
    `- Sectors: ${sectors.join(", ") || "any"}`,
    `- Countries: ${countries.join(", ") || "any"}`,
    `- Stages: ${stages.join(", ") || "any"}`,
    `- Ticket range: ${investor.ticket_min_eur ?? "?"}–${investor.ticket_max_eur ?? "?"} EUR`,
    `- Total capital: ${investor.total_capital_eur ?? "n/a"} EUR`,
    `- Risk tolerance: ${investor.risk_tolerance ?? "medium"}`,
    `- Free thesis: ${investor.thesis_text ?? "(none)"}`,
    "",
    `Candidate campaigns (${top.length}):`,
    candidatesNote,
  ].join("\n");

  const result = streamObject({
    model: mistral(MODEL_LARGE),
    schema: MatchResultSchema,
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0,
    maxRetries: 3,
  });

  const seen = new Set<string>();
  const items: MatchedItem[] = [];

  for await (const partial of result.partialObjectStream) {
    const matches = partial.matches;
    if (!matches) continue;
    for (const m of matches) {
      if (!m) continue;
      const id = m.campaignId;
      const score = m.fitScore;
      const reasoning = m.reasoning;
      if (!id || score == null || !reasoning || reasoning.length < 20) continue;
      if (seen.has(id)) continue;
      const safe: MatchedItem = {
        campaignId: id,
        fitScore: typeof score === "number" ? score : 0,
        reasoning,
      };
      seen.add(id);
      items.push(safe);
      onItem(safe);
    }
  }

  return items;
}
