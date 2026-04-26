/**
 * End-to-end verification of the on-chain campaign lifecycle.
 *
 * Run after `pnpm chain:node` + `pnpm chain:deploy`. Creates ephemeral test
 * users + a synthetic campaign, exercises the full flow:
 *   1. SMB initiates the contract
 *   2. Two investors commit (target hit by the second)
 *   3. Contract auto-disburses to the SMB
 *   4. SMB repays principal + interest
 *   5. Investors are paid pro-rata
 *
 * Asserts on-chain state, SQLite cache, commitment payouts and timeline at
 * every step. Cleans up the test rows on exit so the demo data stays pristine.
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
import {
  getOrCreateWallet,
  readEurBalance,
} from "@/lib/chain/wallet";
import { isChainReachable } from "@/lib/chain/client";
import { readChainAddresses } from "@/lib/chain/config";
import {
  computeOwedEur,
  createCampaignOnChain,
  commitFromUser,
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

const TARGET_EUR = 100_000;
const INTEREST_BPS = 800; // 8%
const DURATION_DAYS = 90;
const COMMIT_DEADLINE_DAYS = 30;

const COMMIT_A_EUR = 40_000;
const COMMIT_B_EUR = 60_000;

async function main(): Promise<void> {
  console.log("\n→ Loanly · on-chain campaign lifecycle e2e\n");

  if (!(await isChainReachable())) {
    fail("Chain unreachable — start `pnpm chain:node` first.");
  }
  if (!readChainAddresses()) {
    fail("No data/chain.json — run `pnpm chain:deploy` first.");
  }
  ok("Chain reachable, contracts deployed");

  // 1. Synthetic users + campaign ───────────────────────────────────────────
  const tag = `e2e-${Date.now()}`;
  const smbId = `e2e-smb-${tag}`;
  const invAId = `e2e-inv-a-${tag}`;
  const invBId = `e2e-inv-b-${tag}`;
  const companyId = `e2e-co-${tag}`;
  const campaignId = randomUUID();
  const investorAEntityId = `e2e-inv-entity-a-${tag}`;
  const investorBEntityId = `e2e-inv-entity-b-${tag}`;

  upsertUser({ id: smbId, email: `${tag}-smb@e2e.local`, type: "smb", displayName: "E2E SMB" });
  upsertUser({ id: invAId, email: `${tag}-a@e2e.local`, type: "investor", displayName: "E2E Investor A" });
  upsertUser({ id: invBId, email: `${tag}-b@e2e.local`, type: "investor", displayName: "E2E Investor B" });
  const db = getDb();
  db.prepare(
    `INSERT INTO companies (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`
  ).run(companyId, smbId, `E2E Co ${tag}`, Date.now());
  db.prepare(
    `INSERT INTO campaigns (id, company_id, title, capital_seeking_eur, use_of_funds, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    campaignId,
    companyId,
    "E2E lifecycle test",
    TARGET_EUR,
    "Verify on-chain end-to-end flow",
    Date.now()
  );
  db.prepare(
    `INSERT INTO investors (id, user_id, display_name, total_capital_eur, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(investorAEntityId, invAId, "E2E Investor A", 1_000_000, Date.now());
  db.prepare(
    `INSERT INTO investors (id, user_id, display_name, total_capital_eur, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(investorBEntityId, invBId, "E2E Investor B", 1_000_000, Date.now());

  ok(`Synthetic users + campaign provisioned (campaign=${campaignId.slice(0, 8)}…)`);

  let exitCode = 0;
  try {
    // 2. Provision wallets ──────────────────────────────────────────────────
    const smbWallet = await getOrCreateWallet(smbId);
    const invAWallet = await getOrCreateWallet(invAId);
    const invBWallet = await getOrCreateWallet(invBId);
    ok(`SMB wallet: ${smbWallet.address}`);
    ok(`Investor A wallet: ${invAWallet.address}`);
    ok(`Investor B wallet: ${invBWallet.address}`);

    const balA0 = await readEurBalance(invAWallet.address as `0x${string}`);
    const balB0 = await readEurBalance(invBWallet.address as `0x${string}`);
    if (balA0 < COMMIT_A_EUR) fail(`Investor A starter balance too low: ${balA0}`);
    if (balB0 < COMMIT_B_EUR) fail(`Investor B starter balance too low: ${balB0}`);
    ok(`Starter balances: A=${fmtEur(balA0)} · B=${fmtEur(balB0)}`);

    // 3. SMB initiates the on-chain contract ────────────────────────────────
    const commitDeadlineSec = Math.floor(Date.now() / 1000) + COMMIT_DEADLINE_DAYS * 86_400;
    const { txHash: deployTx } = await createCampaignOnChain({
      campaignId,
      borrowerAddress: smbWallet.address as `0x${string}`,
      targetEur: TARGET_EUR,
      interestBps: INTEREST_BPS,
      durationDays: DURATION_DAYS,
      commitDeadlineSec,
    });
    insertCampaignContract({
      campaign_id: campaignId,
      borrower_address: smbWallet.address,
      target_eur: TARGET_EUR,
      interest_bps: INTEREST_BPS,
      duration_days: DURATION_DAYS,
      commit_deadline: commitDeadlineSec * 1000,
      deploy_tx_hash: deployTx,
    });
    await refreshCampaignState(campaignId);
    const c1 = getCampaignContract(campaignId) as CampaignContractRow;
    if (c1.on_chain_state !== "open") fail(`Expected open after create, got ${c1.on_chain_state}`);
    ok(`Contract created on-chain (tx=${deployTx.slice(0, 10)}…) state=open`);

    // 4. Investor A commits 40k ─────────────────────────────────────────────
    await commitFromUser({
      campaignId,
      investorUserId: invAId,
      amountEur: COMMIT_A_EUR,
    });
    const c2 = getCampaignContract(campaignId) as CampaignContractRow;
    if (c2.on_chain_state !== "open") fail(`Expected open after first commit, got ${c2.on_chain_state}`);
    if (c2.total_committed_eur !== COMMIT_A_EUR) {
      fail(`Expected committed=${COMMIT_A_EUR}, got ${c2.total_committed_eur}`);
    }
    ok(`Investor A committed ${fmtEur(COMMIT_A_EUR)} · committed=${fmtEur(c2.total_committed_eur)}/${fmtEur(TARGET_EUR)}`);

    // 5. Investor B commits 60k → triggers auto-funding ─────────────────────
    await commitFromUser({
      campaignId,
      investorUserId: invBId,
      amountEur: COMMIT_B_EUR,
    });
    const c3 = getCampaignContract(campaignId) as CampaignContractRow;
    if (c3.on_chain_state !== "funded") {
      fail(`Expected funded after target hit, got ${c3.on_chain_state}`);
    }
    if (c3.total_committed_eur !== TARGET_EUR) {
      fail(`Expected committed=${TARGET_EUR}, got ${c3.total_committed_eur}`);
    }
    if (!c3.funded_at) fail("funded_at should be set");
    ok(`Investor B committed ${fmtEur(COMMIT_B_EUR)} → state=funded, funded_at=${new Date(c3.funded_at).toISOString()}`);

    const smbBalAfterFund = await readEurBalance(smbWallet.address as `0x${string}`);
    if (smbBalAfterFund < TARGET_EUR) {
      fail(`SMB should hold ≥${TARGET_EUR} after disburse, got ${smbBalAfterFund}`);
    }
    ok(`SMB received disbursement: balance=${fmtEur(smbBalAfterFund)}`);

    // 6. SMB repays principal + interest ────────────────────────────────────
    const owed = computeOwedEur(TARGET_EUR, INTEREST_BPS);
    await repayFromUser({
      campaignId,
      borrowerUserId: smbId,
      amountEur: owed,
    });
    const c4 = getCampaignContract(campaignId) as CampaignContractRow;
    if (c4.on_chain_state !== "repaid") {
      fail(`Expected repaid after full repayment, got ${c4.on_chain_state}`);
    }
    if (Math.abs(c4.total_repaid_eur - owed) > 1) {
      fail(`Expected total_repaid≈${owed}, got ${c4.total_repaid_eur}`);
    }
    if (!c4.repaid_at) fail("repaid_at should be set");
    ok(`SMB repaid ${fmtEur(owed)} (principal + 8% interest) → state=repaid`);

    // 7. Verify pro-rata payouts ───────────────────────────────────────────
    const balA1 = await readEurBalance(invAWallet.address as `0x${string}`);
    const balB1 = await readEurBalance(invBWallet.address as `0x${string}`);
    const expectedA = computeOwedEur(COMMIT_A_EUR, INTEREST_BPS);
    const expectedB = computeOwedEur(COMMIT_B_EUR, INTEREST_BPS);
    const gainA = balA1 - balA0 + COMMIT_A_EUR;
    const gainB = balB1 - balB0 + COMMIT_B_EUR;
    if (Math.abs(gainA - expectedA) > 1) {
      fail(`Investor A net=${gainA}, expected ${expectedA}`);
    }
    if (Math.abs(gainB - expectedB) > 1) {
      fail(`Investor B net=${gainB}, expected ${expectedB}`);
    }
    ok(`Investor A received ${fmtEur(gainA)} (expected ${fmtEur(expectedA)})`);
    ok(`Investor B received ${fmtEur(gainB)} (expected ${fmtEur(expectedB)})`);

    // 8. Verify commitments rows reconciled ────────────────────────────────
    const commits = listCommitmentsByCampaign(campaignId);
    if (commits.length !== 2) fail(`Expected 2 commitments, got ${commits.length}`);
    for (const c of commits) {
      if (c.status !== "repaid") fail(`Commitment ${c.id} status=${c.status}, expected repaid`);
      const expected = computeOwedEur(c.amount_eur, INTEREST_BPS);
      if (Math.abs(c.repaid_amount_eur - expected) > 1) {
        fail(`Commitment ${c.id} repaid_amount=${c.repaid_amount_eur}, expected ${expected}`);
      }
    }
    ok(`Both commitments reconciled to status=repaid`);

    // 9. Verify timeline ───────────────────────────────────────────────────
    // On a single-shot full repay, the contract emits InvestorPaid + Repaid
    // (no RepaymentReceived — that's only fired on partial repayments).
    const events = listChainEventsByCampaign(campaignId, 100);
    const kinds = events.map((e) => e.kind);
    const required: typeof kinds = [
      "CampaignCreated",
      "Committed",
      "Funded",
      "InvestorPaid",
      "Repaid",
    ];
    for (const k of required) {
      if (!kinds.includes(k)) fail(`Timeline missing event ${k} (have: ${kinds.join(", ")})`);
    }
    const committedCount = kinds.filter((k) => k === "Committed").length;
    if (committedCount !== 2) {
      fail(`Expected 2 Committed events, got ${committedCount}`);
    }
    const investorPaidCount = kinds.filter((k) => k === "InvestorPaid").length;
    if (investorPaidCount !== 2) {
      fail(`Expected 2 InvestorPaid events, got ${investorPaidCount}`);
    }
    ok(`Timeline has all expected events: ${[...new Set(kinds)].join(" → ")}`);

    console.log("\n✓ End-to-end on-chain lifecycle verified.\n");
  } catch (err) {
    console.error("\n✗ E2E run failed:", err);
    exitCode = 1;
  } finally {
    // Clean up test rows so the demo seed isn't polluted.
    const cleanup = getDb();
    cleanup.prepare(`DELETE FROM chain_events WHERE campaign_id = ?`).run(campaignId);
    cleanup.prepare(`DELETE FROM commitments WHERE campaign_id = ?`).run(campaignId);
    cleanup.prepare(`DELETE FROM campaign_contracts WHERE campaign_id = ?`).run(campaignId);
    cleanup.prepare(`DELETE FROM investors WHERE id IN (?, ?)`).run(
      investorAEntityId,
      investorBEntityId
    );
    cleanup.prepare(`DELETE FROM campaigns WHERE id = ?`).run(campaignId);
    cleanup.prepare(`DELETE FROM companies WHERE id = ?`).run(companyId);
    cleanup.prepare(`DELETE FROM wallets WHERE user_id IN (?, ?, ?)`).run(
      smbId,
      invAId,
      invBId
    );
    cleanup.prepare(`DELETE FROM users WHERE id IN (?, ?, ?)`).run(
      smbId,
      invAId,
      invBId
    );
    ok("Cleaned up synthetic e2e rows");
  }

  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
