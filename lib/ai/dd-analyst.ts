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

const AGENT_SYSTEM_PROMPT = `You are a senior investment analyst preparing a due-diligence brief on a small business. CALL TOOLS, then write notes — do NOT write notes first.

Tools:
- webSearch(query): Tavily web search. Returns up to 5 hits with URLs + content excerpts.
- fetchUrl(url): fetch a page (HTML stripped, 50KB cap). Use on the company website AND on the best webSearch hit.
- companyLookup(name, country): SIRENE registry lookup (FR only).

REQUIRED first moves (do them in order, no preamble text):
1. webSearch with the company name + a disambiguator from the brief (city, sector, or product) — e.g. "Petit Paquet logistique Bordeaux", NOT "Petit Paquet" alone.
2. If a website is in the brief, fetchUrl it.
3. If country is FR, companyLookup(name, "FR") once.
4. After step 1, fetchUrl the single most promising webSearch URL.
5. Optional: one more targeted webSearch (founder name, "site:linkedin.com", or a competitor angle).

Stop after 4–7 useful tool calls. Don't repeat a failed query — vary it (synonym, drop a word, founder name).

THEN, only after the tool calls, write a short plain-text findings note covering: overview, traction, team, market context, risk flags (low/medium/high), and the URLs you actually visited. Be skeptical when public footprint is thin given pitch claims.`;

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
- evidence: cite EXACT urls the agent actually visited from the "URLS THE AGENT ACTUALLY VISITED" list at the bottom of the prompt. Copy them verbatim — never strip them down to a bare domain (no "linkedin.com", always the full "https://linkedin.com/in/<handle>"). If the agent made no tool calls, return an empty evidence array. Each cited source needs: source label (e.g. "LinkedIn — Thomas Despin", "Atelier Fiscal website", "SIRENE registry"), full url, and a one-sentence excerpt or finding tied to that source.

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

  // Walk the agent's tool calls and pull out the EXACT URLs it visited.
  // We pin these to the structuring step so the Sources section cites the
  // real article/profile/registry pages instead of bare domains.
  const usedSources = extractUsedSources(research.steps);

  const toolSummary = research.steps
    .flatMap((step) =>
      step.content
        .filter((p) => p.type === "tool-result")
        .map((p) => {
          const r = p as Extract<typeof p, { type: "tool-result" }>;
          return `[tool ${r.toolName}] ${JSON.stringify(r.output).slice(0, 2500)}`;
        })
    )
    .join("\n\n");

  const sourcesList = usedSources.length
    ? usedSources
        .map((s, i) => {
          const meta = [s.kind.toUpperCase(), s.title].filter(Boolean).join(" · ");
          const excerpt = s.excerpt ? `\n   excerpt: ${s.excerpt}` : "";
          return `[${i + 1}] ${meta}\n   url: ${s.url}${excerpt}`;
        })
        .join("\n")
    : "(none — agent made no tool calls)";

  const findingsNote = [
    "ANALYST NOTES",
    research.text || "(no narrative)",
    "",
    "RAW TOOL RESULTS",
    toolSummary || "(no tool results)",
    "",
    "URLS THE AGENT ACTUALLY VISITED (cite these EXACT urls in evidence — never bare domains):",
    sourcesList,
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

type UsedSource = {
  kind: "web" | "url" | "registry";
  url: string;
  title?: string;
  excerpt?: string;
};

// Walk the agent's research steps and pull out the actual URLs it touched.
// We capture top webSearch hits (the model has those URLs available even if it
// doesn't fetch them), every fetchUrl input, and a synthetic registry URL when
// SIRENE returns a match. The result is fed back to the structuring step so
// evidence cites real pages instead of bare domains.
function extractUsedSources(
  steps: Array<{ content: Array<unknown> }>
): UsedSource[] {
  const out: UsedSource[] = [];
  const seen = new Set<string>();
  const push = (s: UsedSource) => {
    if (!s.url || seen.has(s.url)) return;
    seen.add(s.url);
    out.push(s);
  };
  for (const step of steps) {
    for (const part of step.content) {
      const p = part as {
        type?: string;
        toolName?: string;
        input?: unknown;
        output?: unknown;
      };
      if (p.type === "tool-call" && p.toolName === "fetchUrl") {
        const inp = p.input as { url?: string } | undefined;
        if (inp?.url) push({ kind: "url", url: inp.url });
      }
      if (p.type === "tool-result" && p.toolName === "webSearch") {
        const arr = p.output as
          | Array<{ url?: string; title?: string; content?: string }>
          | undefined;
        if (Array.isArray(arr)) {
          for (const r of arr.slice(0, 3)) {
            if (r.url) {
              push({
                kind: "web",
                url: r.url,
                title: r.title,
                excerpt: r.content?.slice(0, 220),
              });
            }
          }
        }
      }
      if (p.type === "tool-result" && p.toolName === "companyLookup") {
        const o = p.output as
          | { found?: boolean; siren?: string; legalName?: string }
          | undefined;
        if (o?.found && o.siren) {
          push({
            kind: "registry",
            url: `https://annuaire-entreprises.data.gouv.fr/entreprise/${o.siren}`,
            title: o.legalName ? `SIRENE — ${o.legalName}` : "SIRENE registry",
          });
        }
      }
    }
  }
  return out;
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
      // companyLookup returns { found: true, legalName, ... } | { found: false, reason }.
      if (result?.found) {
        const legalName = result.legalName ? ` — ${result.legalName}` : "";
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
