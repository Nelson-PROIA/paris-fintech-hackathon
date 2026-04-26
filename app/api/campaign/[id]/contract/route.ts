import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import {
  getCampaignContract,
  getCampaignWithCompany,
  insertCampaignContract,
  listChainEventsByCampaign,
  listCommitmentsByCampaign,
} from "@/lib/db";
import { isChainReachable } from "@/lib/chain/client";
import { getOrCreateWallet } from "@/lib/chain/wallet";
import {
  computeOwedEur,
  createCampaignOnChain,
  refreshCampaignState,
} from "@/lib/chain/marketplace";
import { requireChainAddresses } from "@/lib/chain/config";

export const runtime = "nodejs";
export const maxDuration = 30;

const InitiateSchema = z.object({
  interestBps: z.number().int().min(0).max(5000),
  durationDays: z.number().int().min(1).max(3650),
  commitDeadlineDays: z.number().int().min(1).max(365),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUser();
  const { id } = await params;
  const camp = getCampaignWithCompany(id);
  if (!camp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const contract = getCampaignContract(id);
  if (!contract) {
    return NextResponse.json({ contract: null, commitments: [], events: [] });
  }
  const commitments = listCommitmentsByCampaign(id);
  const events = listChainEventsByCampaign(id, 50);
  const owedEur = computeOwedEur(contract.target_eur, contract.interest_bps);
  return NextResponse.json({
    contract: { ...contract, owed_eur: owedEur },
    commitments,
    events,
  });
}

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
  if (getCampaignContract(id)) {
    return NextResponse.json(
      { error: "already_initiated" },
      { status: 409 }
    );
  }
  if (!(await isChainReachable())) {
    return NextResponse.json(
      { error: "chain_offline" },
      { status: 503 }
    );
  }
  try {
    requireChainAddresses();
  } catch {
    return NextResponse.json(
      { error: "chain_not_deployed" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = InitiateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const wallet = await getOrCreateWallet(user.id);
  const commitDeadline =
    Math.floor(Date.now() / 1000) +
    parsed.data.commitDeadlineDays * 24 * 60 * 60;

  const { txHash } = await createCampaignOnChain({
    campaignId: id,
    borrowerAddress: wallet.address as `0x${string}`,
    targetEur: camp.capital_seeking_eur,
    interestBps: parsed.data.interestBps,
    durationDays: parsed.data.durationDays,
    commitDeadlineSec: commitDeadline,
  });

  insertCampaignContract({
    campaign_id: id,
    borrower_address: wallet.address,
    target_eur: camp.capital_seeking_eur,
    interest_bps: parsed.data.interestBps,
    duration_days: parsed.data.durationDays,
    commit_deadline: commitDeadline * 1000,
    deploy_tx_hash: txHash,
  });

  await refreshCampaignState(id);

  return NextResponse.json({ ok: true, txHash });
}
