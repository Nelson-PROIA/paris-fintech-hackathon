import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getCampaignWithCompany,
  getDb,
  getOrCreateInvestor,
  listCampaigns,
  type CampaignWithCompany,
} from "@/lib/db";
import {
  PortfolioInputSchema,
  computeDiversification,
  rankCandidates,
  runConstructor,
  type FinalPosition,
  type PortfolioResult,
} from "@/lib/ai/portfolio-constructor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await requireRole("investor");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PortfolioInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const candidatePool = listCampaigns({
    sectors: input.sectors?.length ? input.sectors : undefined,
    countries: input.countries?.length ? input.countries : undefined,
    limit: 200,
  });
  if (!candidatePool.length) {
    return NextResponse.json(
      { error: "No campaigns match the hard filters. Widen sectors or countries." },
      { status: 400 }
    );
  }

  const ranked = rankCandidates(candidatePool, input);

  let raw;
  try {
    raw = await runConstructor(input, ranked);
  } catch (e) {
    return NextResponse.json(
      {
        error: "Portfolio construction failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }

  const merged = new Map<string, { allocationEur: number; rationale: string }>();
  for (const p of raw.positions) {
    const prev = merged.get(p.campaignId);
    if (prev) {
      prev.allocationEur += p.allocationEur;
    } else {
      merged.set(p.campaignId, {
        allocationEur: p.allocationEur,
        rationale: p.rationale,
      });
    }
  }

  const positions: FinalPosition[] = [];
  for (const [campaignId, m] of merged) {
    const camp: CampaignWithCompany | null = getCampaignWithCompany(campaignId);
    if (!camp) continue;
    const cappedAlloc = Math.min(
      Math.min(m.allocationEur, Math.floor(input.totalCapital * 0.25)),
      camp.capital_seeking_eur
    );
    if (cappedAlloc < 1000) continue;
    positions.push({
      campaignId,
      campaign: camp,
      allocationEur: cappedAlloc,
      allocationPct: 0,
      rationale: m.rationale,
    });
  }

  const totalDeployed = positions.reduce((s, p) => s + p.allocationEur, 0);
  for (const p of positions) {
    p.allocationPct = totalDeployed
      ? Math.round((p.allocationEur / totalDeployed) * 1000) / 10
      : 0;
  }

  const diversification = computeDiversification(positions);

  const result: PortfolioResult = {
    positions,
    diversification,
    expectedRiskProfile: raw.expectedRiskProfile,
    totalDeployed,
    totalRequested: input.totalCapital,
  };

  const investor = getOrCreateInvestor(
    user.id,
    user.display_name ?? user.email
  );
  getDb()
    .prepare(
      "INSERT INTO portfolio_proposals (investor_id, query_json, result_json, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(
      investor.id,
      JSON.stringify(input),
      JSON.stringify(result),
      Date.now()
    );

  return NextResponse.json({ ok: true, result });
}
