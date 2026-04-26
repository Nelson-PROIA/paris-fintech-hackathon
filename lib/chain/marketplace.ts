import {
  encodePacked,
  formatUnits,
  getContract,
  keccak256,
  parseEventLogs,
  parseUnits,
  type Hex,
} from "viem";
import { clientForPrivateKey, operatorClient, publicClient } from "./client";
import { requireChainAddresses } from "./config";
import {
  MARKETPLACE_ABI,
  MOCK_EUR_ABI,
  ON_CHAIN_STATUS,
  TOKEN_DECIMALS,
} from "./abi";
import {
  getCampaignContract,
  insertChainEvent,
  insertCommitment,
  listChainEventsByCampaign,
  updateCampaignContract,
  updateCommitment,
  listCommitmentsByCampaign,
  type ChainEventKind,
  type OnChainState,
} from "@/lib/db";
import {
  decryptPk,
  fundGasIfNeeded,
  getOrCreateWallet,
} from "./wallet";

/**
 * Bridge the off-chain UUID and the on-chain bytes32. We hash so the
 * marketplace doesn't have to deal with our string ids — and the same id
 * always maps to the same on-chain key for indexer reconciliation.
 */
export function campaignKey(campaignId: string): Hex {
  return keccak256(encodePacked(["string"], [campaignId]));
}

function eurToWei(amountEur: number): bigint {
  return parseUnits(String(amountEur), TOKEN_DECIMALS);
}

function weiToEur(amount: bigint): number {
  return Number(formatUnits(amount, TOKEN_DECIMALS));
}

/**
 * Owed amount = principal + interest_bps/10000. Mirrors the Solidity helper.
 */
export function computeOwedEur(principalEur: number, interestBps: number): number {
  return principalEur + (principalEur * interestBps) / 10000;
}

// ── Operator: deploy a campaign ─────────────────────────────────────────────

export async function createCampaignOnChain(opts: {
  campaignId: string;
  borrowerAddress: `0x${string}`;
  targetEur: number;
  interestBps: number;
  durationDays: number;
  commitDeadlineSec: number;
}): Promise<{ txHash: Hex; blockNumber: number }> {
  const { marketplaceAddress } = requireChainAddresses();
  const op = operatorClient();
  const txHash = await op.writeContract({
    address: marketplaceAddress,
    abi: MARKETPLACE_ABI,
    functionName: "createCampaign",
    args: [
      campaignKey(opts.campaignId),
      opts.borrowerAddress,
      eurToWei(opts.targetEur),
      opts.interestBps,
      opts.durationDays,
      BigInt(opts.commitDeadlineSec),
    ],
    account: op.account!,
    chain: op.chain,
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash });
  await indexReceipt(opts.campaignId, txHash, receipt);
  return { txHash, blockNumber: Number(receipt.blockNumber) };
}

// ── Investor: commit ────────────────────────────────────────────────────────

export async function commitFromUser(opts: {
  campaignId: string;
  investorUserId: string;
  amountEur: number;
}): Promise<{ txHash: Hex; commitmentId: string }> {
  const { marketplaceAddress, mockEurAddress } = requireChainAddresses();
  const wallet = await getOrCreateWallet(opts.investorUserId);
  await fundGasIfNeeded(wallet.address as `0x${string}`);

  const investor = clientForPrivateKey(decryptPk(wallet.encrypted_pk));
  const amount = eurToWei(opts.amountEur);

  const approveHash = await investor.writeContract({
    address: mockEurAddress,
    abi: MOCK_EUR_ABI,
    functionName: "approve",
    args: [marketplaceAddress, amount],
    account: investor.account!,
    chain: investor.chain,
  });
  await publicClient().waitForTransactionReceipt({ hash: approveHash });

  const txHash = await investor.writeContract({
    address: marketplaceAddress,
    abi: MARKETPLACE_ABI,
    functionName: "commit",
    args: [campaignKey(opts.campaignId), amount],
    account: investor.account!,
    chain: investor.chain,
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash });

  const commitment = insertCommitment({
    campaign_id: opts.campaignId,
    investor_user_id: opts.investorUserId,
    investor_address: wallet.address,
    amount_eur: opts.amountEur,
    tx_hash: txHash,
  });

  await indexReceipt(opts.campaignId, txHash, receipt);
  await refreshCampaignState(opts.campaignId);
  return { txHash, commitmentId: commitment.id };
}

// ── Borrower: repay ─────────────────────────────────────────────────────────

export async function repayFromUser(opts: {
  campaignId: string;
  borrowerUserId: string;
  amountEur: number;
}): Promise<{ txHash: Hex }> {
  const { marketplaceAddress, mockEurAddress } = requireChainAddresses();
  const wallet = await getOrCreateWallet(opts.borrowerUserId);
  await fundGasIfNeeded(wallet.address as `0x${string}`);

  // Borrower might not have enough mEURC if they're holding the principal but
  // owe interest on top. The platform tops them up to cover interest so the
  // demo can complete the loop without manual intervention.
  await topUpBorrowerForRepay(
    wallet.address as `0x${string}`,
    opts.amountEur
  );

  const borrower = clientForPrivateKey(decryptPk(wallet.encrypted_pk));
  const amount = eurToWei(opts.amountEur);

  const approveHash = await borrower.writeContract({
    address: mockEurAddress,
    abi: MOCK_EUR_ABI,
    functionName: "approve",
    args: [marketplaceAddress, amount],
    account: borrower.account!,
    chain: borrower.chain,
  });
  await publicClient().waitForTransactionReceipt({ hash: approveHash });

  const txHash = await borrower.writeContract({
    address: marketplaceAddress,
    abi: MARKETPLACE_ABI,
    functionName: "repay",
    args: [campaignKey(opts.campaignId), amount],
    account: borrower.account!,
    chain: borrower.chain,
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash });
  await indexReceipt(opts.campaignId, txHash, receipt);
  await refreshCampaignState(opts.campaignId);
  return { txHash };
}

async function topUpBorrowerForRepay(
  borrowerAddress: `0x${string}`,
  amountEur: number
): Promise<void> {
  const { mockEurAddress } = requireChainAddresses();
  const balance = await readEurBalance(borrowerAddress);
  if (balance >= amountEur) return;
  const shortfall = amountEur - balance;
  const op = operatorClient();
  const hash = await op.writeContract({
    address: mockEurAddress,
    abi: MOCK_EUR_ABI,
    functionName: "mint",
    args: [borrowerAddress, eurToWei(shortfall)],
    account: op.account!,
    chain: op.chain,
  });
  await publicClient().waitForTransactionReceipt({ hash });
}

async function readEurBalance(address: `0x${string}`): Promise<number> {
  const { mockEurAddress } = requireChainAddresses();
  const raw = (await publicClient().readContract({
    address: mockEurAddress,
    abi: MOCK_EUR_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
  return weiToEur(raw);
}

// ── Cancel ─────────────────────────────────────────────────────────────────

export async function cancelFromUser(opts: {
  campaignId: string;
  borrowerUserId: string;
}): Promise<{ txHash: Hex }> {
  const { marketplaceAddress } = requireChainAddresses();
  const wallet = await getOrCreateWallet(opts.borrowerUserId);
  await fundGasIfNeeded(wallet.address as `0x${string}`);
  const borrower = clientForPrivateKey(decryptPk(wallet.encrypted_pk));
  const txHash = await borrower.writeContract({
    address: marketplaceAddress,
    abi: MARKETPLACE_ABI,
    functionName: "cancel",
    args: [campaignKey(opts.campaignId)],
    account: borrower.account!,
    chain: borrower.chain,
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash });
  await indexReceipt(opts.campaignId, txHash, receipt);
  await refreshCampaignState(opts.campaignId);
  return { txHash };
}

// ── Reads ───────────────────────────────────────────────────────────────────

export type CampaignChainState = {
  borrower: `0x${string}`;
  targetEur: number;
  interestBps: number;
  durationDays: number;
  commitDeadlineSec: number;
  fundedAtSec: number;
  repaidAtSec: number;
  createdAtSec: number;
  totalCommittedEur: number;
  totalRepaidEur: number;
  status: OnChainState;
  investorCount: number;
};

export async function readCampaignFromChain(
  campaignId: string
): Promise<CampaignChainState | null> {
  const { marketplaceAddress } = requireChainAddresses();
  const data = (await publicClient().readContract({
    address: marketplaceAddress,
    abi: MARKETPLACE_ABI,
    functionName: "getCampaign",
    args: [campaignKey(campaignId)],
  })) as {
    borrower: `0x${string}`;
    target: bigint;
    interestBps: number;
    durationDays: number;
    commitDeadline: bigint;
    fundedAt: bigint;
    repaidAt: bigint;
    createdAt: bigint;
    totalCommitted: bigint;
    totalRepaid: bigint;
    status: number;
    investorCount: bigint;
  };

  if (data.status === 0) return null;

  const status = ON_CHAIN_STATUS[data.status] ?? "open";
  return {
    borrower: data.borrower,
    targetEur: weiToEur(data.target),
    interestBps: data.interestBps,
    durationDays: data.durationDays,
    commitDeadlineSec: Number(data.commitDeadline),
    fundedAtSec: Number(data.fundedAt),
    repaidAtSec: Number(data.repaidAt),
    createdAtSec: Number(data.createdAt),
    totalCommittedEur: weiToEur(data.totalCommitted),
    totalRepaidEur: weiToEur(data.totalRepaid),
    status: status === "none" ? "open" : (status as OnChainState),
    investorCount: Number(data.investorCount),
  };
}

/**
 * Re-reads the campaign struct from chain and reconciles the SQLite cache.
 * Cheap (single eth_call) and authoritative — used after every write so the
 * UI is always in sync.
 */
export async function refreshCampaignState(
  campaignId: string
): Promise<void> {
  const onChain = await readCampaignFromChain(campaignId);
  const cached = getCampaignContract(campaignId);
  if (!onChain || !cached) return;

  const patch: Parameters<typeof updateCampaignContract>[1] = {
    total_committed_eur: onChain.totalCommittedEur,
    total_repaid_eur: onChain.totalRepaidEur,
    on_chain_state: onChain.status,
  };
  if (onChain.fundedAtSec > 0 && cached.funded_at == null) {
    patch.funded_at = onChain.fundedAtSec * 1000;
  }
  if (onChain.repaidAtSec > 0 && cached.repaid_at == null) {
    patch.repaid_at = onChain.repaidAtSec * 1000;
  }
  if (
    onChain.status === "cancelled" &&
    cached.cancelled_at == null
  ) {
    patch.cancelled_at = Date.now();
  }
  updateCampaignContract(campaignId, patch);

  // Update commitments based on on-chain state
  const commitments = listCommitmentsByCampaign(campaignId);
  for (const c of commitments) {
    if (onChain.status === "cancelled") {
      if (c.status !== "refunded") {
        updateCommitment(c.id, { status: "refunded" });
      }
      continue;
    }
    if (onChain.status === "repaid") {
      const owed = computeOwedEur(c.amount_eur, cached.interest_bps);
      updateCommitment(c.id, {
        status: "repaid",
        repaid_amount_eur: Math.round(owed),
      });
      continue;
    }
    if (onChain.status === "repaying") {
      const repaidShare =
        onChain.totalCommittedEur > 0
          ? (onChain.totalRepaidEur * c.amount_eur) /
            onChain.totalCommittedEur
          : 0;
      updateCommitment(c.id, {
        status: "repaid_partial",
        repaid_amount_eur: Math.round(repaidShare),
      });
      continue;
    }
  }
}

// ── Event indexing ──────────────────────────────────────────────────────────

const KIND_FROM_NAME: Record<string, ChainEventKind | undefined> = {
  CampaignCreated: "CampaignCreated",
  Committed: "Committed",
  Funded: "Funded",
  RepaymentReceived: "RepaymentReceived",
  InvestorPaid: "InvestorPaid",
  InvestorRefunded: "InvestorRefunded",
  Repaid: "Repaid",
  Cancelled: "Cancelled",
};

async function indexReceipt(
  campaignId: string,
  txHash: Hex,
  receipt: { logs: unknown[]; blockNumber: bigint }
): Promise<void> {
  const logs = parseEventLogs({
    abi: MARKETPLACE_ABI,
    logs: receipt.logs as never,
  });
  for (const log of logs) {
    const name = (log as unknown as { eventName: string }).eventName;
    const kind = KIND_FROM_NAME[name];
    if (!kind) continue;
    const logIndex = Number(
      (log as unknown as { logIndex?: number | bigint }).logIndex ?? 0
    );
    insertChainEvent({
      campaignId,
      kind,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      logIndex,
      args: serializeArgs(
        (log as unknown as { args: Record<string, unknown> }).args
      ),
    });
  }
}

function serializeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "bigint") {
      out[k] = v.toString();
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function listEvents(campaignId: string, limit = 50) {
  return listChainEventsByCampaign(campaignId, limit);
}

// ── Wallet wiring (re-exported for routes) ─────────────────────────────────

export { getOrCreateWallet };
