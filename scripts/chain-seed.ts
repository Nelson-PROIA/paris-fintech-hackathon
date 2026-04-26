/**
 * Initialises on-chain contracts for a curated set of seed campaigns so that
 * investors can immediately see "Commit capital" buttons in the UI without
 * having to first create an SMB account and click Initiate.
 *
 * Picks a mix of sectors / countries / ticket sizes for demo variety. Idempotent:
 * if a campaign already has a `campaign_contracts` row, it is skipped.
 *
 *   pnpm chain:seed
 */

import {
  getCampaignContract,
  getDb,
  insertCampaignContract,
  type CampaignContractRow,
} from "@/lib/db";
import { isChainReachable } from "@/lib/chain/client";
import { readChainAddresses } from "@/lib/chain/config";
import { getOrCreateWallet } from "@/lib/chain/wallet";
import {
  createCampaignOnChain,
  refreshCampaignState,
} from "@/lib/chain/marketplace";

type SeedTerms = {
  matchTitle: string;
  interestBps: number;
  durationDays: number;
  commitDeadlineDays: number;
};

const PICKS: SeedTerms[] = [
  {
    matchTitle: "Lyon roastery + B2B sales team",
    interestBps: 800,
    durationDays: 90,
    commitDeadlineDays: 30,
  },
  {
    matchTitle: "Engineering scale-up",
    interestBps: 950,
    durationDays: 120,
    commitDeadlineDays: 30,
  },
  {
    matchTitle: "Florence workshop + artisan hires",
    interestBps: 700,
    durationDays: 90,
    commitDeadlineDays: 21,
  },
  {
    matchTitle: "GTM + 12-month runway",
    interestBps: 850,
    durationDays: 180,
    commitDeadlineDays: 30,
  },
  {
    matchTitle: "Internal automation tool",
    interestBps: 600,
    durationDays: 60,
    commitDeadlineDays: 14,
  },
  {
    matchTitle: "Fleet + dispatch software",
    interestBps: 900,
    durationDays: 120,
    commitDeadlineDays: 30,
  },
];

type CampaignWithOwner = {
  campaign_id: string;
  campaign_title: string;
  capital_seeking_eur: number;
  user_id: string;
};

function findCampaignByTitle(title: string): CampaignWithOwner | null {
  return (
    (getDb()
      .prepare(
        `SELECT c.id AS campaign_id, c.title AS campaign_title,
                c.capital_seeking_eur, co.user_id
         FROM campaigns c
         JOIN companies co ON co.id = c.company_id
         WHERE c.title LIKE ? AND co.user_id LIKE 'seed-%'
         LIMIT 1`
      )
      .get(`%${title}%`) as CampaignWithOwner | undefined) ?? null
  );
}

async function initiate(seed: SeedTerms): Promise<{
  status: "deployed" | "skipped";
  detail: string;
}> {
  const camp = findCampaignByTitle(seed.matchTitle);
  if (!camp) {
    return { status: "skipped", detail: `no seeded campaign matching "${seed.matchTitle}"` };
  }
  const existing: CampaignContractRow | null = getCampaignContract(camp.campaign_id);
  if (existing) {
    return {
      status: "skipped",
      detail: `${camp.campaign_title} (already deployed, state=${existing.on_chain_state})`,
    };
  }

  const wallet = await getOrCreateWallet(camp.user_id);
  const commitDeadlineSec =
    Math.floor(Date.now() / 1000) + seed.commitDeadlineDays * 86_400;
  const { txHash } = await createCampaignOnChain({
    campaignId: camp.campaign_id,
    borrowerAddress: wallet.address as `0x${string}`,
    targetEur: camp.capital_seeking_eur,
    interestBps: seed.interestBps,
    durationDays: seed.durationDays,
    commitDeadlineSec,
  });
  insertCampaignContract({
    campaign_id: camp.campaign_id,
    borrower_address: wallet.address,
    target_eur: camp.capital_seeking_eur,
    interest_bps: seed.interestBps,
    duration_days: seed.durationDays,
    commit_deadline: commitDeadlineSec * 1000,
    deploy_tx_hash: txHash,
  });
  await refreshCampaignState(camp.campaign_id);

  return {
    status: "deployed",
    detail: `${camp.campaign_title} · target=€${camp.capital_seeking_eur.toLocaleString(
      "en-US"
    )} · ${(seed.interestBps / 100).toFixed(2)}% / ${seed.durationDays}d · tx=${txHash.slice(0, 10)}…`,
  };
}

async function main(): Promise<void> {
  console.log("\n→ Seeding on-chain contracts for demo campaigns\n");
  if (!(await isChainReachable())) {
    console.error("✗ Chain unreachable — start `pnpm chain:node` first.");
    process.exit(1);
  }
  if (!readChainAddresses()) {
    console.error("✗ No data/chain.json — run `pnpm chain:deploy` first.");
    process.exit(1);
  }

  let deployed = 0;
  for (const seed of PICKS) {
    const r = await initiate(seed);
    if (r.status === "deployed") {
      deployed++;
      console.log(`  ✓ ${r.detail}`);
    } else {
      console.log(`  · ${r.detail} — skipped`);
    }
  }
  console.log(
    `\nDone. ${deployed} contract${deployed === 1 ? "" : "s"} deployed (idempotent — rerun safe).\n`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
