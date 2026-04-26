import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  getCampaignContract,
  getCampaignWithCompany,
} from "@/lib/db";
import { isChainReachable } from "@/lib/chain/client";
import { commitFromUser } from "@/lib/chain/marketplace";
import { getOrCreateWallet, readEurBalance } from "@/lib/chain/wallet";

export const runtime = "nodejs";
export const maxDuration = 30;

const CommitSchema = z.object({
  amountEur: z.number().int().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("investor");
  const { id } = await params;
  const camp = getCampaignWithCompany(id);
  if (!camp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (camp.company.user_id === user.id) {
    return NextResponse.json(
      { error: "self_commit_forbidden" },
      { status: 403 }
    );
  }
  const contract = getCampaignContract(id);
  if (!contract) {
    return NextResponse.json(
      { error: "contract_not_initiated" },
      { status: 409 }
    );
  }
  if (contract.on_chain_state !== "open") {
    return NextResponse.json(
      { error: "campaign_not_open", state: contract.on_chain_state },
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
  const parsed = CommitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const remaining = contract.target_eur - contract.total_committed_eur;
  if (parsed.data.amountEur > remaining) {
    return NextResponse.json(
      { error: "exceeds_remaining", remaining },
      { status: 400 }
    );
  }

  const wallet = await getOrCreateWallet(user.id);
  const balance = await readEurBalance(wallet.address as `0x${string}`);
  if (balance < parsed.data.amountEur) {
    return NextResponse.json(
      { error: "insufficient_balance", balance },
      { status: 400 }
    );
  }

  const result = await commitFromUser({
    campaignId: id,
    investorUserId: user.id,
    amountEur: parsed.data.amountEur,
  });

  return NextResponse.json({ ok: true, ...result });
}
