import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  getCampaignContract,
  getCampaignWithCompany,
} from "@/lib/db";
import { isChainReachable } from "@/lib/chain/client";
import { computeOwedEur, repayFromUser } from "@/lib/chain/marketplace";

export const runtime = "nodejs";
export const maxDuration = 30;

const RepaySchema = z.object({
  amountEur: z.number().int().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("smb");
  const { id } = await params;
  const camp = getCampaignWithCompany(id);
  if (!camp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (camp.company.user_id !== user.id) {
    return NextResponse.json({ error: "not_your_campaign" }, { status: 403 });
  }
  const contract = getCampaignContract(id);
  if (!contract) {
    return NextResponse.json(
      { error: "contract_not_initiated" },
      { status: 409 }
    );
  }
  if (
    contract.on_chain_state !== "funded" &&
    contract.on_chain_state !== "repaying"
  ) {
    return NextResponse.json(
      { error: "not_funded", state: contract.on_chain_state },
      { status: 409 }
    );
  }
  if (!(await isChainReachable())) {
    return NextResponse.json({ error: "chain_offline" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = RepaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const owed = computeOwedEur(contract.target_eur, contract.interest_bps);
  const remaining = owed - contract.total_repaid_eur;
  const amount = Math.min(parsed.data.amountEur, remaining);
  if (amount <= 0) {
    return NextResponse.json(
      { error: "already_fully_repaid" },
      { status: 409 }
    );
  }

  const result = await repayFromUser({
    campaignId: id,
    borrowerUserId: user.id,
    amountEur: amount,
  });

  return NextResponse.json({ ok: true, ...result });
}
