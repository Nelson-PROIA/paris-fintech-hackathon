import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getDb, getOrCreateInvestor, updateInvestorThesis } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const ThesisInputSchema = z.object({
  thesisText: z.string().max(2000).optional().nullable(),
  sectors: z.array(z.string()).max(20).optional(),
  countries: z.array(z.string()).max(20).optional(),
  stages: z
    .array(z.enum(["pre_revenue", "early", "growth"]))
    .max(3)
    .optional(),
  ticketMinEur: z.number().int().min(0).nullable().optional(),
  ticketMaxEur: z.number().int().min(0).nullable().optional(),
  totalCapitalEur: z.number().int().min(0).nullable().optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).nullable().optional(),
});

export async function POST(req: Request) {
  const user = await requireRole("investor");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ThesisInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const i = parsed.data;

  getOrCreateInvestor(user.id, user.display_name ?? user.email);

  const updated = updateInvestorThesis(user.id, {
    thesis_text: i.thesisText ?? null,
    sectors_json: i.sectors ? JSON.stringify(i.sectors) : null,
    countries_json: i.countries ? JSON.stringify(i.countries) : null,
    stages_json: i.stages ? JSON.stringify(i.stages) : null,
    ticket_min_eur: i.ticketMinEur ?? null,
    ticket_max_eur: i.ticketMaxEur ?? null,
    total_capital_eur: i.totalCapitalEur ?? null,
    risk_tolerance: i.riskTolerance ?? null,
  });

  // Invalidate any cached match for this investor.
  getDb()
    .prepare("DELETE FROM match_caches WHERE investor_id = ?")
    .run(updated.id);

  return NextResponse.json({ ok: true, investor: updated });
}
