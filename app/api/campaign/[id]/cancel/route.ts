import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getCampaignContract,
  getCampaignWithCompany,
} from "@/lib/db";
import { isChainReachable } from "@/lib/chain/client";
import { cancelFromUser } from "@/lib/chain/marketplace";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  _req: Request,
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
  if (contract.on_chain_state !== "open") {
    return NextResponse.json(
      { error: "cannot_cancel", state: contract.on_chain_state },
      { status: 409 }
    );
  }
  if (!(await isChainReachable())) {
    return NextResponse.json({ error: "chain_offline" }, { status: 503 });
  }

  const result = await cancelFromUser({
    campaignId: id,
    borrowerUserId: user.id,
  });
  return NextResponse.json({ ok: true, ...result });
}
