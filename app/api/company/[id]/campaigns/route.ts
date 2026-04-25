import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createCampaign, getCompanyById } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 15;

const InputSchema = z.object({
  title: z.string().min(3).max(120),
  capitalSeekingEur: z.number().int().min(1000),
  useOfFunds: z.string().min(10).max(2000),
  pitchSummary: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("smb");
  const { id: companyId } = await params;
  const company = getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ error: "company not found" }, { status: 404 });
  }
  if (company.user_id !== user.id) {
    return NextResponse.json(
      { error: "not your company" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const campaign = createCampaign({
    company_id: companyId,
    title: parsed.data.title,
    capital_seeking_eur: parsed.data.capitalSeekingEur,
    use_of_funds: parsed.data.useOfFunds,
    pitch_summary: parsed.data.pitchSummary ?? null,
    status: "open",
  });

  return NextResponse.json({ ok: true, campaignId: campaign.id });
}
