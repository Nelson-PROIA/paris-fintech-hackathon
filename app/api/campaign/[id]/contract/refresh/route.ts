import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getCampaignContract,
  getCampaignWithCompany,
  listCommitmentsByCampaign,
} from "@/lib/db";
import { isChainReachable } from "@/lib/chain/client";
import { refreshCampaignState } from "@/lib/chain/marketplace";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Re-reads the marketplace struct via eth_call and reconciles the SQLite
 * cache. Returns the freshest snapshot for the contract explorer's
 * "Verify on-chain" button. Anyone authenticated can hit this — it's
 * idempotent and only ever pulls authoritative state from chain.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUser();
  const { id } = await params;
  const camp = getCampaignWithCompany(id);
  if (!camp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!getCampaignContract(id)) {
    return NextResponse.json({ error: "no_contract" }, { status: 404 });
  }
  if (!(await isChainReachable())) {
    return NextResponse.json({ error: "chain_offline" }, { status: 503 });
  }

  await refreshCampaignState(id);

  const fresh = getCampaignContract(id)!;
  const commitments = listCommitmentsByCampaign(id);
  const investorCount = new Set(commitments.map((c) => c.investor_user_id))
    .size;

  return NextResponse.json({
    snapshot: {
      state: fresh.on_chain_state,
      totalCommittedEur: fresh.total_committed_eur,
      totalRepaidEur: fresh.total_repaid_eur,
      remainingEur: Math.max(
        0,
        fresh.target_eur - fresh.total_committed_eur
      ),
      fundedAtMs: fresh.funded_at,
      repaidAtMs: fresh.repaid_at,
      cancelledAtMs: fresh.cancelled_at,
      commitDeadlineMs: fresh.commit_deadline,
      investorCount,
    },
    refreshedAt: Date.now(),
  });
}
