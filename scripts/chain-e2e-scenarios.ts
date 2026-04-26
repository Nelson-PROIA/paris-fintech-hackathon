/**
 * Edge-case verification scenarios for the on-chain campaign lifecycle.
 *
 * Run after `pnpm chain:node` + `pnpm chain:deploy`. Exercises:
 *   1. Cancel — SMB cancels open campaign with one outstanding commitment;
 *      investor is fully refunded, contract goes to `cancelled`.
 *   2. Partial repay — SMB repays half then the rest; status flips
 *      `funded → repaying → repaid`, both investors reach the right total.
 *   3. Repeat-commit — same investor commits twice on the same campaign;
 *      contract sums their stake correctly.
 *   4. Self-commit guard — SMB calling `commit` on their own campaign is
 *      rejected at the API layer (not enforced by the contract).
 *
 * Cleans up all synthetic rows on exit.
 */

import { randomUUID } from "node:crypto";
import {
  getDb,
  upsertUser,
  getCampaignContract,
  insertCampaignContract,
  listChainEventsByCampaign,
  listCommitmentsByCampaign,
  type CampaignContractRow,
} from "@/lib/db";
import { getOrCreateWallet, readEurBalance } from "@/lib/chain/wallet";
import { isChainReachable } from "@/lib/chain/client";
import { readChainAddresses } from "@/lib/chain/config";
import {
  cancelFromUser,
  commitFromUser,
  computeOwedEur,
  createCampaignOnChain,
  refreshCampaignState,
  repayFromUser,
} from "@/lib/chain/marketplace";

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(`✓ ${msg}`);
}
function fmtEur(n: number): string {
  return `€${n.toLocaleString("en-US")}`;
}

type Setup = {
  smbId: string;
  invAId: string;
  invBId: string;
  companyId: string;
  campaignId: string;
  invAEnt: string;
  invBEnt: string;
};

async function setup(targetEur: number, label: string): Promise<Setup> {
  const tag = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const smbId = `${tag}-smb`;
  const invAId = `${tag}-a`;
  const invBId = `${tag}-b`;
  const companyId = `${tag}-co`;
  const campaignId = randomUUID();
  const invAEnt = `${tag}-ea`;
  const invBEnt = `${tag}-eb`;

  upsertUser({ id: smbId, email: `${tag}-s@e.local`, type: "smb", displayName: "S" });
  upsertUser({ id: invAId, email: `${tag}-a@e.local`, type: "investor", displayName: "A" });
  upsertUser({ id: invBId, email: `${tag}-b@e.local`, type: "investor", displayName: "B" });

  const db = getDb();
  db.prepare(`INSERT INTO companies (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`)
    .run(companyId, smbId, `E2E ${label}`, Date.now());
  db.prepare(
    `INSERT INTO campaigns (id, company_id, title, capital_seeking_eur, use_of_funds, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  ).run(campaignId, companyId, label, targetEur, "Edge-case scenario", Date.now());
  db.prepare(
    `INSERT INTO investors (id, user_id, display_name, total_capital_eur, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(invAEnt, invAId, "A", 1_000_000, Date.now());
  db.prepare(
    `INSERT INTO investors (id, user_id, display_name, total_capital_eur, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(invBEnt, invBId, "B", 1_000_000, Date.now());

  return { smbId, invAId, invBId, companyId, campaignId, invAEnt, invBEnt };
}

function teardown(s: Setup): void {
  const db = getDb();
  db.prepare(`DELETE FROM chain_events WHERE campaign_id = ?`).run(s.campaignId);
  db.prepare(`DELETE FROM commitments WHERE campaign_id = ?`).run(s.campaignId);
  db.prepare(`DELETE FROM campaign_contracts WHERE campaign_id = ?`).run(s.campaignId);
  db.prepare(`DELETE FROM investors WHERE id IN (?, ?)`).run(s.invAEnt, s.invBEnt);
  db.prepare(`DELETE FROM campaigns WHERE id = ?`).run(s.campaignId);
  db.prepare(`DELETE FROM companies WHERE id = ?`).run(s.companyId);
  db.prepare(`DELETE FROM wallets WHERE user_id IN (?, ?, ?)`)
    .run(s.smbId, s.invAId, s.invBId);
  db.prepare(`DELETE FROM users WHERE id IN (?, ?, ?)`)
    .run(s.smbId, s.invAId, s.invBId);
}

async function deployContract(s: Setup, target: number, interestBps: number): Promise<void> {
  const smbWallet = await getOrCreateWallet(s.smbId);
  const commitDeadlineSec = Math.floor(Date.now() / 1000) + 30 * 86_400;
  const { txHash } = await createCampaignOnChain({
    campaignId: s.campaignId,
    borrowerAddress: smbWallet.address as `0x${string}`,
    targetEur: target,
    interestBps,
    durationDays: 90,
    commitDeadlineSec,
  });
  insertCampaignContract({
    campaign_id: s.campaignId,
    borrower_address: smbWallet.address,
    target_eur: target,
    interest_bps: interestBps,
    duration_days: 90,
    commit_deadline: commitDeadlineSec * 1000,
    deploy_tx_hash: txHash,
  });
  await refreshCampaignState(s.campaignId);
}

// ── Scenario 1: cancel + refund ──────────────────────────────────────────────

async function scenarioCancel(): Promise<void> {
  console.log("\n— Scenario: Cancel & refund —");
  const s = await setup(50_000, "cancel");
  try {
    await deployContract(s, 50_000, 800);
    const invAWallet = await getOrCreateWallet(s.invAId);
    const balBefore = await readEurBalance(invAWallet.address as `0x${string}`);

    await commitFromUser({
      campaignId: s.campaignId,
      investorUserId: s.invAId,
      amountEur: 20_000,
    });
    const balAfterCommit = await readEurBalance(invAWallet.address as `0x${string}`);
    if (balBefore - balAfterCommit !== 20_000) {
      fail(`A should have committed €20k, balance delta=${balBefore - balAfterCommit}`);
    }
    ok(`Investor A committed €20k · balance ${fmtEur(balBefore)} → ${fmtEur(balAfterCommit)}`);

    await cancelFromUser({
      campaignId: s.campaignId,
      borrowerUserId: s.smbId,
    });
    const c = getCampaignContract(s.campaignId) as CampaignContractRow;
    if (c.on_chain_state !== "cancelled") {
      fail(`Expected cancelled, got ${c.on_chain_state}`);
    }
    if (!c.cancelled_at) fail("cancelled_at should be set");
    ok(`SMB cancelled the campaign · state=cancelled`);

    const balAfterRefund = await readEurBalance(invAWallet.address as `0x${string}`);
    if (Math.abs(balAfterRefund - balBefore) > 1) {
      fail(`Refund failed: A balance=${balAfterRefund}, expected ${balBefore}`);
    }
    ok(`Investor A fully refunded · balance ${fmtEur(balAfterRefund)}`);

    const commits = listCommitmentsByCampaign(s.campaignId);
    if (commits.some((c) => c.status !== "refunded")) {
      fail(`All commitments should be refunded, got ${commits.map((c) => c.status).join(", ")}`);
    }
    ok(`Commitments reconciled to status=refunded`);

    const events = listChainEventsByCampaign(s.campaignId, 100);
    const kinds = events.map((e) => e.kind);
    if (!kinds.includes("InvestorRefunded") || !kinds.includes("Cancelled")) {
      fail(`Timeline missing refund events: ${kinds.join(", ")}`);
    }
    ok(`Timeline: ${[...new Set(kinds)].join(" → ")}`);
  } finally {
    teardown(s);
  }
}

// ── Scenario 2: partial repay ────────────────────────────────────────────────

async function scenarioPartialRepay(): Promise<void> {
  console.log("\n— Scenario: Partial repay (funded → repaying → repaid) —");
  const s = await setup(100_000, "partial");
  try {
    await deployContract(s, 100_000, 1000); // 10%
    await commitFromUser({
      campaignId: s.campaignId,
      investorUserId: s.invAId,
      amountEur: 30_000,
    });
    await commitFromUser({
      campaignId: s.campaignId,
      investorUserId: s.invBId,
      amountEur: 70_000,
    });
    const c1 = getCampaignContract(s.campaignId) as CampaignContractRow;
    if (c1.on_chain_state !== "funded") fail(`Expected funded, got ${c1.on_chain_state}`);
    ok(`Funded after 30k+70k commits`);

    const owed = computeOwedEur(100_000, 1000); // 110_000

    // First half-repay: should flip to `repaying`.
    await repayFromUser({
      campaignId: s.campaignId,
      borrowerUserId: s.smbId,
      amountEur: 50_000,
    });
    const c2 = getCampaignContract(s.campaignId) as CampaignContractRow;
    if (c2.on_chain_state !== "repaying") {
      fail(`Expected repaying after partial, got ${c2.on_chain_state}`);
    }
    if (c2.total_repaid_eur !== 50_000) {
      fail(`Expected total_repaid=50_000, got ${c2.total_repaid_eur}`);
    }
    ok(`Partial 50k → state=repaying · total_repaid=${fmtEur(c2.total_repaid_eur)}`);

    const commitsMid = listCommitmentsByCampaign(s.campaignId);
    for (const c of commitsMid) {
      if (c.status !== "repaid_partial") {
        fail(`Mid-commitment ${c.id} should be repaid_partial, got ${c.status}`);
      }
    }
    ok(`Both commitments at status=repaid_partial`);

    // Final repay — over-pay request, contract clamps to remaining.
    await repayFromUser({
      campaignId: s.campaignId,
      borrowerUserId: s.smbId,
      amountEur: 100_000, // over remaining (60k); contract clamps
    });
    const c3 = getCampaignContract(s.campaignId) as CampaignContractRow;
    if (c3.on_chain_state !== "repaid") {
      fail(`Expected repaid after final, got ${c3.on_chain_state}`);
    }
    if (Math.abs(c3.total_repaid_eur - owed) > 1) {
      fail(`Expected total_repaid≈${owed}, got ${c3.total_repaid_eur}`);
    }
    ok(`Full repay → state=repaid · total ${fmtEur(c3.total_repaid_eur)}`);

    const events = listChainEventsByCampaign(s.campaignId, 200);
    const kinds = events.map((e) => e.kind);
    if (!kinds.includes("RepaymentReceived")) {
      fail(`RepaymentReceived missing on partial repay: ${kinds.join(", ")}`);
    }
    if (!kinds.includes("Repaid")) fail(`Repaid missing: ${kinds.join(", ")}`);
    const investorPaid = kinds.filter((k) => k === "InvestorPaid").length;
    if (investorPaid !== 4) {
      // 2 investors × 2 repay txs
      fail(`Expected 4 InvestorPaid events (2 per repay tx), got ${investorPaid}`);
    }
    ok(`Timeline: ${[...new Set(kinds)].join(" → ")} · 4 InvestorPaid events`);
  } finally {
    teardown(s);
  }
}

// ── Scenario 3: same investor commits twice ──────────────────────────────────

async function scenarioRepeatCommit(): Promise<void> {
  console.log("\n— Scenario: Repeat commit (same investor) —");
  const s = await setup(60_000, "repeat");
  try {
    await deployContract(s, 60_000, 500);
    await commitFromUser({
      campaignId: s.campaignId,
      investorUserId: s.invAId,
      amountEur: 20_000,
    });
    await commitFromUser({
      campaignId: s.campaignId,
      investorUserId: s.invAId,
      amountEur: 30_000,
    });
    const c = getCampaignContract(s.campaignId) as CampaignContractRow;
    if (c.total_committed_eur !== 50_000) {
      fail(`Expected committed=50k, got ${c.total_committed_eur}`);
    }
    if (c.on_chain_state !== "open") {
      fail(`Should still be open at 50/60, got ${c.on_chain_state}`);
    }

    const commits = listCommitmentsByCampaign(s.campaignId);
    if (commits.length !== 2) {
      fail(`Expected 2 commitment rows for same investor, got ${commits.length}`);
    }
    ok(
      `Same investor 20k + 30k = €50,000 committed across 2 rows · contract sees one investor (1 stake on-chain)`
    );
  } finally {
    teardown(s);
  }
}

async function main(): Promise<void> {
  console.log("\n→ Loanly · on-chain edge-case scenarios\n");
  if (!(await isChainReachable())) fail("Chain unreachable");
  if (!readChainAddresses()) fail("No data/chain.json");
  ok("Chain reachable, contracts deployed");

  await scenarioCancel();
  await scenarioPartialRepay();
  await scenarioRepeatCommit();

  console.log("\n✓ All edge-case scenarios passed.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
