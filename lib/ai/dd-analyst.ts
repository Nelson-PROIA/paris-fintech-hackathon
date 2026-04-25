import { z } from "zod";
import { generateObject, generateText, stepCountIs, tool } from "ai";
import { mistral, MODEL_LARGE } from "@/lib/ai/client";
import { fetchUrlText } from "@/lib/tools/fetch-url";
import { webSearch } from "@/lib/tools/web-search";
import { companyLookup } from "@/lib/tools/company-lookup";
import type { CampaignRow, CompanyRow } from "@/lib/db";

export const RiskFlagSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  flag: z.string().describe("Short title for the risk"),
  evidence: z
    .string()
    .describe("Specific reason or quote that grounds this flag"),
});

export const EvidenceSchema = z.object({
  source: z.string().describe("Source name (e.g. 'company website', 'Le Figaro', 'SIRENE')"),
  url: z.string(),
  excerpt: z
    .string()
    .describe("1-2 sentence excerpt from the source"),
});

export const DDBriefSchema = z.object({
  overview: z
    .string()
    .min(50)
    .describe("2-3 neutral sentences describing what the company does and its scale."),
  traction: z
    .string()
    .min(20)
    .describe("Numbers and signals: revenue, customers, growth, contracts."),
  team: z
    .string()
    .min(20)
    .describe(
      "Founder/team background if findable. If not publicly verifiable, say so."
    ),
  marketContext: z
    .string()
    .min(20)
    .describe("Sector, geography, competitive context."),
  riskFlags: z
    .array(RiskFlagSchema)
    .describe("Risks with severity and grounding evidence."),
  sentimentScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "Overall confidence score; ~70 baseline, lower with more/severer risks, higher with strong corroborated traction."
    ),
  evidence: z
    .array(EvidenceSchema)
    .describe("Sources cited, with URL and excerpt."),
});

export type DDBrief = z.infer<typeof DDBriefSchema>;

const AGENT_SYSTEM_PROMPT = `You are a senior investment analyst preparing a one-page due-diligence brief on a small business for a busy investor.

You have three tools:
- webSearch(query): public web search (Tavily). Returns up to 5 results with URLs and content excerpts.
- fetchUrl(url): fetch a specific URL and return text content (capped at 50KB).
- companyLookup(name, country): French SIRENE registry lookup. Returns null/empty for non-FR.

Process:
1. Start with webSearch for "{company name} {city or country}" to find mentions, news, social presence.
2. If they have a website (provided in the prompt), fetchUrl on it for traction signals and team info.
3. If FR, run companyLookup to confirm legal existence and founding date.
4. Optionally do one more webSearch on something specific you need to verify.
5. Stop calling tools after 4-6 useful tool steps.

Be skeptical:
- If the company has zero public footprint, that's a risk flag.
- If their website is barely a landing page or looks abandoned, that's a risk flag.
- If pitch claims (revenue, customers) are not corroborated by any public source, flag it.

When you stop calling tools, output a plain-text findings note that summarises: overview, traction, team background, market context, risk flags, and the URLs you actually used. A separate process will structure your findings into the final brief.`;

const STRUCTURE_SYSTEM_PROMPT = `You are converting an investment analyst's research notes into a structured DD brief.

Rules:
- overview: 2-3 neutral sentences. What the company does, scale, location.
- traction: Numbers and signals only. If no public corroboration, say so.
- team: Founder/team facts if findable; if not, "Not publicly verifiable."
- marketContext: Sector, geography, competitive lens.
- riskFlags: 0-5 items. Each has severity (low/medium/high), short flag title, evidence.
  - "No online footprint" = medium-to-high severity for a company claiming traction.
  - "Pitch claims not corroborated" = medium.
  - "Active in registry, growing team" = no flag (positive).
- sentimentScore: integer 0-100. Start at 70. Subtract 10-20 per medium risk, 20-30 per high. Add 5-10 per strong corroborated positive.
- evidence: cite the URLs the agent actually called. Each gets source label, url, short excerpt.

Be honest. Don't invent. If the agent's notes are thin, the brief should say so.`;

export type DDAgentInput = {
  company: CompanyRow;
  campaigns?: CampaignRow[];
};

export async function runDDAgent({
  company,
  campaigns = [],
}: DDAgentInput): Promise<DDBrief> {
  const totalSeeking = campaigns.reduce(
    (s, c) => s + (c.status === "open" ? c.capital_seeking_eur : 0),
    0
  );
  const taskBrief = [
    `Company: ${company.name}`,
    `Country: ${company.country ?? "(unknown)"}`,
    `City: ${company.city ?? "(unknown)"}`,
    `Sector: ${company.sector ?? "(unknown)"}`,
    `Stage: ${company.stage ?? "(unknown)"}`,
    `Founded: ${company.founded_year ?? "(unknown)"}`,
    `Team size: ${company.team_size ?? "(unknown)"}`,
    `Website: ${company.website ?? "(none)"}`,
    `Monthly revenue (claimed): ${company.monthly_revenue_eur ? company.monthly_revenue_eur + " EUR" : "(none/unknown)"}`,
    campaigns.length
      ? `Active campaigns (${campaigns.length}, total seeking ${totalSeeking} EUR):\n${campaigns
          .map(
            (c) =>
              `  - ${c.title}: ${c.capital_seeking_eur} EUR — ${c.use_of_funds}`
          )
          .join("\n")}`
      : "No active campaigns",
    "",
    "Company pitch:",
    company.pitch ?? "(no pitch on file)",
  ].join("\n");

  // Step 1 — agentic research with tools
  const research = await generateText({
    model: mistral(MODEL_LARGE),
    system: AGENT_SYSTEM_PROMPT,
    prompt: taskBrief,
    tools: {
      webSearch: tool({
        description:
          "Public web search via Tavily. Use for company name, news, mentions. Returns up to 5 results.",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => webSearch(query, 5),
      }),
      fetchUrl: tool({
        description:
          "Fetch a specific URL and return text content (HTML stripped, 50KB cap). Use to read company website or articles.",
        inputSchema: z.object({ url: z.string() }),
        execute: async ({ url }) => fetchUrlText(url),
      }),
      companyLookup: tool({
        description:
          "French SIRENE registry lookup by company name. Returns legal status, founding date, principal activity. Returns reason='non_FR_lookup_unsupported' for non-FR companies.",
        inputSchema: z.object({
          name: z.string(),
          country: z.string().describe("ISO-2 country code"),
        }),
        execute: async ({ name, country }) => companyLookup(name, country),
      }),
    },
    stopWhen: stepCountIs(8),
    temperature: 0.2,
  });

  const toolSummary = research.steps
    .flatMap((step) =>
      step.content
        .filter((p) => p.type === "tool-result")
        .map((p) => {
          const r = p as Extract<typeof p, { type: "tool-result" }>;
          return `[tool ${r.toolName}] ${JSON.stringify(r.output).slice(0, 1500)}`;
        })
    )
    .join("\n\n");

  const findingsNote = [
    "ANALYST NOTES",
    research.text || "(no narrative)",
    "",
    "RAW TOOL RESULTS",
    toolSummary || "(no tool results)",
  ].join("\n\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await generateObject({
        model: mistral(MODEL_LARGE),
        schema: DDBriefSchema,
        system: STRUCTURE_SYSTEM_PROMPT,
        prompt: ["Company profile:", taskBrief, "", findingsNote].join("\n\n"),
        temperature: 0,
      });
      return r.object;
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
  throw new Error("unreachable");
}
