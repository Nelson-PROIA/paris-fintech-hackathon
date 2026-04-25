import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getCampaignWithCompany,
  getDb,
  getOrCreateInvestor,
  listCampaigns,
} from "@/lib/db";
import { runMatch, type MatchedItemHydrated } from "@/lib/ai/match";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type MatchCacheRow = {
  investor_id: string;
  result_json: string;
  generated_at: number;
};

export async function GET(req: Request) {
  const user = await requireRole("investor");
  const investor = getOrCreateInvestor(
    user.id,
    user.display_name ?? user.email
  );

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const db = getDb();

  if (!force) {
    const cached = db
      .prepare("SELECT * FROM match_caches WHERE investor_id = ?")
      .get(investor.id) as MatchCacheRow | undefined;
    if (cached && Date.now() - cached.generated_at < CACHE_TTL_MS) {
      return NextResponse.json({
        cached: true,
        generatedAt: cached.generated_at,
        matches: JSON.parse(cached.result_json) as MatchedItemHydrated[],
      });
    }
  }

  const sectors = investor.sectors_json
    ? (JSON.parse(investor.sectors_json) as string[])
    : undefined;
  const countries = investor.countries_json
    ? (JSON.parse(investor.countries_json) as string[])
    : undefined;
  const ticketMin = investor.ticket_min_eur ?? undefined;
  const ticketMax = investor.ticket_max_eur ?? undefined;

  const candidates = listCampaigns({
    sectors,
    countries,
    ticketMin,
    ticketMax,
    limit: 200,
  });

  if (!candidates.length) {
    const empty: MatchedItemHydrated[] = [];
    db.prepare(
      `INSERT INTO match_caches (investor_id, result_json, generated_at) VALUES (?, ?, ?)
       ON CONFLICT(investor_id) DO UPDATE SET result_json = excluded.result_json, generated_at = excluded.generated_at`
    ).run(investor.id, JSON.stringify(empty), Date.now());
    return NextResponse.json({
      cached: false,
      generatedAt: Date.now(),
      matches: empty,
    });
  }

  let result;
  try {
    result = await runMatch(investor, candidates);
  } catch (e) {
    return NextResponse.json(
      {
        error: "match generation failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }

  // Hydrate
  const hydrated: MatchedItemHydrated[] = [];
  for (const m of result.matches) {
    const camp = getCampaignWithCompany(m.campaignId);
    if (!camp) continue;
    hydrated.push({ ...m, campaign: camp });
  }

  db.prepare(
    `INSERT INTO match_caches (investor_id, result_json, generated_at) VALUES (?, ?, ?)
     ON CONFLICT(investor_id) DO UPDATE SET result_json = excluded.result_json, generated_at = excluded.generated_at`
  ).run(investor.id, JSON.stringify(hydrated), Date.now());

  return NextResponse.json({
    cached: false,
    generatedAt: Date.now(),
    matches: hydrated,
  });
}
