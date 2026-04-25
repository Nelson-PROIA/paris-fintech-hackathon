import { NextResponse } from "next/server";
import { runDDAgent, type DDBrief } from "@/lib/ai/dd-analyst";
import { getCompanyById, getDb, listCampaignsByCompany } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type DDBriefRow = {
  id: number;
  company_id: string;
  brief_json: string;
  generated_at: number;
};

function getCached(companyId: string): DDBriefRow | null {
  return (
    (getDb()
      .prepare(
        "SELECT * FROM dd_briefs WHERE company_id = ? ORDER BY generated_at DESC LIMIT 1"
      )
      .get(companyId) as DDBriefRow | undefined) ?? null
  );
}

function saveBrief(companyId: string, brief: DDBrief): DDBriefRow {
  getDb()
    .prepare(
      "INSERT INTO dd_briefs (company_id, brief_json, generated_at) VALUES (?, ?, ?)"
    )
    .run(companyId, JSON.stringify(brief), Date.now());
  return getCached(companyId)!;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const company = getCompanyById(id);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (!force) {
    const cached = getCached(id);
    if (cached && Date.now() - cached.generated_at < STALE_AFTER_MS) {
      return NextResponse.json({
        cached: true,
        generatedAt: cached.generated_at,
        brief: JSON.parse(cached.brief_json) as DDBrief,
      });
    }
  }

  const campaigns = listCampaignsByCompany(id);
  try {
    const brief = await runDDAgent({ company, campaigns });
    const row = saveBrief(id, brief);
    return NextResponse.json({
      cached: false,
      generatedAt: row.generated_at,
      brief,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "DD generation failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

export const POST = GET;
