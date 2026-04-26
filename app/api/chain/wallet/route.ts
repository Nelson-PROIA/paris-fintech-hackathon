import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isChainReachable } from "@/lib/chain/client";
import {
  getOrCreateWallet,
  readEurBalance,
  readEthBalance,
} from "@/lib/chain/wallet";
import { requireChainAddresses } from "@/lib/chain/config";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET() {
  const user = await requireUser();
  if (!(await isChainReachable())) {
    return NextResponse.json(
      { error: "chain_offline", message: "Local chain is offline. Run `pnpm chain:node`." },
      { status: 503 }
    );
  }
  try {
    requireChainAddresses();
  } catch {
    return NextResponse.json(
      {
        error: "chain_not_deployed",
        message: "Contracts not deployed. Run `pnpm chain:deploy`.",
      },
      { status: 503 }
    );
  }

  const wallet = await getOrCreateWallet(user.id);
  const [balanceEur, balanceEth] = await Promise.all([
    readEurBalance(wallet.address as `0x${string}`),
    readEthBalance(wallet.address as `0x${string}`),
  ]);

  return NextResponse.json({
    address: wallet.address,
    balanceEur,
    balanceEth,
    role: user.type,
  });
}
