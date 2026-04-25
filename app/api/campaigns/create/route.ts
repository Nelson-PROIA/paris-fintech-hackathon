import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  createCampaign,
  getCompanyById,
  type CampaignMeta,
} from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 15;

const NeedDataSchema = z.object({
  needs: z.array(z.string()).min(1),
  amount_eur: z.number().int().min(1000),
  duration_days: z.string().min(1),
  urgency: z.enum(["very_urgent", "this_week", "this_month", "flexible"]),
  need_description: z.string().min(10).max(2000),
});

const InputSchema = z.object({
  companyId: z.string().min(1),
  data: z.record(z.unknown()),
  documentIds: z.array(z.string()).optional(),
});

const NEED_LABELS: Record<string, string> = {
  invoice_advance: "Invoice factoring",
  working_capital: "Working capital",
  stock_purchase: "Inventory purchase",
  supplier_payment: "Supplier payment",
  payroll: "Payroll",
  short_invest: "Short-term investment",
  other: "Funding",
};

const URGENCY_LABEL: Record<string, string> = {
  very_urgent: "very urgent",
  this_week: "this week",
  this_month: "this month",
  flexible: "flexible",
};

export async function POST(req: Request) {
  const user = await requireRole("smb");

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
  const { companyId, data, documentIds } = parsed.data;

  const company = getCompanyById(companyId);
  if (!company) {
    return NextResponse.json({ error: "company not found" }, { status: 404 });
  }
  if (company.user_id !== user.id) {
    return NextResponse.json({ error: "not your company" }, { status: 403 });
  }

  const need = NeedDataSchema.safeParse(data);
  if (!need.success) {
    return NextResponse.json(
      {
        error: "Need data incomplete",
        issues: need.error.flatten(),
      },
      { status: 400 }
    );
  }

  const meta: CampaignMeta = {
    need_types: need.data.needs,
    urgency: need.data.urgency,
    duration_days: Number(need.data.duration_days),
    need_description: need.data.need_description,
    document_ids: documentIds && documentIds.length > 0 ? documentIds : undefined,
  };

  const primaryNeed = need.data.needs[0];
  const niceNeed = NEED_LABELS[primaryNeed] ?? "Funding";
  const title = `${niceNeed} — ${formatEur(need.data.amount_eur)} over ${need.data.duration_days}d`;
  const useOfFunds = `${need.data.needs
    .map((n) => NEED_LABELS[n] ?? n)
    .join(", ")} · ${URGENCY_LABEL[need.data.urgency]} · ${need.data.duration_days} days.`;

  const campaign = createCampaign({
    company_id: companyId,
    title,
    capital_seeking_eur: need.data.amount_eur,
    use_of_funds: useOfFunds,
    pitch_summary: need.data.need_description,
    status: "open",
    meta_json: JSON.stringify(meta),
  });

  return NextResponse.json({ ok: true, campaignId: campaign.id });
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
