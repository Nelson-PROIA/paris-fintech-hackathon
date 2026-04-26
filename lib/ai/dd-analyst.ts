import { z } from "zod";
import { generateObject, generateText, stepCountIs, tool } from "ai";
import { mistral, MODEL_LARGE, withModelFallback } from "@/lib/ai/client";
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

Tools:
- webSearch(query): Tavily public web search. Returns up to 5 hits with URLs and content excerpts. ALWAYS read the snippets — if they look relevant, fetchUrl the most promising URL.
- fetchUrl(url): fetch HTML and return stripped text (50KB cap). Use this on the company's own website AND on the most promising search hits.
- companyLookup(name, country): SIRENE registry lookup (French companies only).

Search strategy — be precise, search like a human, never one-shot a generic name:

1. Build queries that disambiguate. The COMPANY NAME alone is almost never enough — it collides with everything (a "Petit Paquet" search hits Instagram bakeries). Always combine name + a disambiguator from the brief: city, sector keyword, founder name, product name, SIRET hint, or domain.
   Good: "Petit Paquet logistique Bordeaux", "Boulangerie Martin SAS Lyon SIREN", "Lisbonne Data analytics Portugal".
   Bad: "Petit Paquet", "Loanly".

2. If the website is provided in the brief, fetchUrl it FIRST (before more searches) — it usually has team, pricing, and product detail you can't get otherwise.

3. After the first webSearch, if results look relevant, IMMEDIATELY fetchUrl the most promising 1–2 URLs. Don't pile up generic searches before reading anything.

4. If the country is FR, call companyLookup(name, "FR") once. If found, the legal name + founding date + activity code anchor everything else; surface them in your notes.

5. If a search comes back empty, don't repeat the same query — vary it: drop a word, add a sector synonym ("logistics" vs "logistique" vs "delivery"), try the founder name from the company brief, or try a site:linkedin.com / site:societe.com filter.

6. Stop after 4–7 useful tool calls. Diminishing returns past that.

Be skeptical:
- Zero public footprint after disambiguated searches → real risk flag (medium-to-high).
- Website is a thin landing page / 404 / abandoned blog → risk flag (medium).
- Pitch claims (MRR, headcount, customers) with NO corroboration → flag it as medium.
- SIRENE entry inactive, in liquidation, or activity code mismatch → high severity.
- BUT: a tiny SMB legitimately has a small footprint. "No Wikipedia article" is not a risk; "no website + no SIRENE + no LinkedIn" is.

When you stop calling tools, write a plain-text findings note covering: overview, traction, team background, market context, risk flags (with severity), and the URLs you actually relied on. A separate pass will structure this into the final brief.`;

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
  onEvent?: (event: DDAgentEvent) => void;
};

export type DDAgentEvent =
  | { type: "stage"; id: DDStageId; label: string }
  | { type: "stage:done"; id: DDStageId; detail?: string }
  | {
      type: "tool:call";
      tool: "webSearch" | "fetchUrl" | "companyLookup";
      input: unknown;
      stepIndex: number;
    }
  | {
      type: "tool:result";
      tool: "webSearch" | "fetchUrl" | "companyLookup";
      summary: string;
      stepIndex: number;
    };

export type DDStageId = "research" | "structure";

export async function runDDAgent({
  company,
  campaigns = [],
  onEvent,
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

  onEvent?.({ type: "stage", id: "research", label: "Researching the company online" });

  let stepCounter = 0;
  const wrapTool = <T extends "webSearch" | "fetchUrl" | "companyLookup">(
    name: T,
    fn: (input: any) => Promise<any>,
  ) => {
    return async (input: any) => {
      const stepIndex = stepCounter++;
      onEvent?.({ type: "tool:call", tool: name, input, stepIndex });
      const result = await fn(input);
      onEvent?.({
        type: "tool:result",
        tool: name,
        summary: summariseToolResult(name, input, result),
        stepIndex,
      });
      return result;
    };
  };

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
        execute: wrapTool("webSearch", async ({ query }: { query: string }) =>
          webSearch(query, 5)
        ),
      }),
      fetchUrl: tool({
        description:
          "Fetch a specific URL and return text content (HTML stripped, 50KB cap). Use to read company website or articles.",
        inputSchema: z.object({ url: z.string() }),
        execute: wrapTool("fetchUrl", async ({ url }: { url: string }) =>
          fetchUrlText(url)
        ),
      }),
      companyLookup: tool({
        description:
          "French SIRENE registry lookup by company name. Returns legal status, founding date, principal activity. Returns reason='non_FR_lookup_unsupported' for non-FR companies.",
        inputSchema: z.object({
          name: z.string(),
          country: z.string().describe("ISO-2 country code"),
        }),
        execute: wrapTool(
          "companyLookup",
          async ({ name, country }: { name: string; country: string }) =>
            companyLookup(name, country)
        ),
      }),
    },
    stopWhen: stepCountIs(8),
    temperature: 0.2,
    maxRetries: 4,
  });

  onEvent?.({
    type: "stage:done",
    id: "research",
    detail: `${stepCounter} tool ${stepCounter === 1 ? "call" : "calls"}`,
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

  onEvent?.({ type: "stage", id: "structure", label: "Structuring the brief" });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await withModelFallback((model) =>
        generateObject({
          model,
          schema: DDBriefSchema,
          system: STRUCTURE_SYSTEM_PROMPT,
          prompt: ["Company profile:", taskBrief, "", findingsNote].join("\n\n"),
          temperature: 0,
          maxRetries: 3,
        })
      );
      onEvent?.({
        type: "stage:done",
        id: "structure",
        detail: `${r.object.evidence.length} sources · sentiment ${r.object.sentimentScore}`,
      });
      return r.object;
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
  throw new Error("unreachable");
}

function summariseToolResult(
  tool: "webSearch" | "fetchUrl" | "companyLookup",
  input: any,
  result: any
): string {
  try {
    if (tool === "webSearch") {
      // webSearch returns WebSearchResult[] directly, NOT { results: [...] }.
      const n = Array.isArray(result) ? result.length : 0;
      return `${n} result${n === 1 ? "" : "s"} for "${truncate(String(input?.query ?? ""), 60)}"`;
    }
    if (tool === "fetchUrl") {
      // fetchUrlText returns { ok, status, text, ... }. Show byte size +
      // surface non-200/network errors so the user can see what actually
      // happened instead of a misleading "0.0 KB" line.
      if (!result?.ok) {
        const reason = typeof result?.status === "number"
          ? `HTTP ${result.status}`
          : "unreachable";
        return `${reason} from ${hostnameSafe(input?.url)}`;
      }
      const len = typeof result?.text === "string" ? result.text.length : 0;
      return `${(len / 1024).toFixed(1)} KB from ${hostnameSafe(input?.url)}`;
    }
    if (tool === "companyLookup") {
      // companyLookup returns { found: true, ... } | { found: false, reason: string }.
      if (result?.found) {
        const legalName = result.legal_name ? ` — ${result.legal_name}` : "";
        return `match in SIRENE${legalName}`;
      }
      if (result?.reason === "non_FR_lookup_unsupported") return "non-FR (skipped)";
      if (result?.reason === "missing_sirene_token") return "SIRENE token missing";
      return "no match in SIRENE";
    }
  } catch {}
  return "completed";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function hostnameSafe(url: unknown): string {
  if (typeof url !== "string") return "(url)";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
