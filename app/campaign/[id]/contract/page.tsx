import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { encodePacked, keccak256 } from "viem";
import { requireUser } from "@/lib/auth";
import {
  getCampaignContract,
  getCampaignWithCompany,
  listChainEventsByCampaign,
  listCommitmentsByCampaign,
} from "@/lib/db";
import { readChainAddresses, CHAIN_ID, RPC_URL } from "@/lib/chain/config";
import { computeOwedEur } from "@/lib/chain/marketplace";
import { Badge } from "@/components/ui/badge";
import { IdentityPanel } from "@/components/contract/explorer/IdentityPanel";
import { StatePanel } from "@/components/contract/explorer/StatePanel";
import { CashFlowPanel } from "@/components/contract/explorer/CashFlowPanel";
import { CapTablePanel } from "@/components/contract/explorer/CapTablePanel";
import { EventLogPanel } from "@/components/contract/explorer/EventLogPanel";
import { SourcePanel } from "@/components/contract/explorer/SourcePanel";

const STATUS_VARIANT = {
  open: "success",
  funded: "brand",
  repaying: "warning",
  repaid: "default",
  cancelled: "danger",
} as const;

const STATUS_LABEL = {
  open: "Open for commitments",
  funded: "Funded — repaying",
  repaying: "Repaying",
  repaid: "Fully repaid",
  cancelled: "Cancelled",
} as const;

function readSolidity(filename: string): string {
  try {
    return fs.readFileSync(
      path.resolve(process.cwd(), "contracts", filename),
      "utf-8"
    );
  } catch {
    return `// ${filename} — source not found at runtime`;
  }
}

export default async function ContractExplorerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const camp = getCampaignWithCompany(id);
  if (!camp) notFound();

  const contract = getCampaignContract(id);
  if (!contract) {
    return <NoContractView campaignId={id} title={camp.title} />;
  }

  const chainAddrs = readChainAddresses();
  if (!chainAddrs) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Chain not initialised. Run <code>pnpm chain:deploy</code> from the
          project root.
        </p>
      </main>
    );
  }

  const commitments = listCommitmentsByCampaign(id);
  const events = listChainEventsByCampaign(id, 200);
  const campaignKey = keccak256(encodePacked(["string"], [id]));
  const owedEur = computeOwedEur(contract.target_eur, contract.interest_bps);
  const remainingEur = Math.max(
    0,
    contract.target_eur - contract.total_committed_eur
  );
  const investorCount = new Set(commitments.map((c) => c.investor_user_id))
    .size;

  const initialSnapshot = {
    state: contract.on_chain_state,
    totalCommittedEur: contract.total_committed_eur,
    totalRepaidEur: contract.total_repaid_eur,
    remainingEur,
    fundedAtMs: contract.funded_at,
    repaidAtMs: contract.repaid_at,
    cancelledAtMs: contract.cancelled_at,
    commitDeadlineMs: contract.commit_deadline,
    investorCount,
  };

  const sources = [
    {
      name: "LoanlyMarketplace.sol",
      language: "solidity",
      body: readSolidity("LoanlyMarketplace.sol"),
      description:
        "Factory + escrow contract managing every campaign struct.",
    },
    {
      name: "MockEUR.sol",
      language: "solidity",
      body: readSolidity("MockEUR.sol"),
      description: "ERC-20 mEURC token (6 decimals, operator-mintable).",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Top bar */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link
          href={`/campaign/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <span aria-hidden>←</span>
          Back to campaign
        </Link>
        <span className="font-mono text-[11px] text-muted-foreground">
          /campaign/{id}/contract
        </span>
      </div>

      {/* Header */}
      <header className="mt-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Smart contract explorer
        </p>
        <h1 className="mt-1 text-balance text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          {camp.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[contract.on_chain_state]}>
            {STATUS_LABEL[contract.on_chain_state]}
          </Badge>
          <Badge variant="outline">{camp.company.name}</Badge>
          <Badge variant="ghost">
            target € · {contract.duration_days}d ·{" "}
            {(contract.interest_bps / 100).toFixed(2)}%
          </Badge>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Full visibility into the on-chain state of this loan: identity,
          cap table, money flow, every Solidity event, and the verifiable
          source. All data below is read directly from the marketplace
          contract — no off-chain rewriting.
        </p>
      </header>

      <div className="mt-8 space-y-5">
        <IdentityPanel
          marketplaceAddress={chainAddrs.marketplaceAddress}
          tokenAddress={chainAddrs.mockEurAddress}
          borrowerAddress={contract.borrower_address}
          campaignKey={campaignKey}
          chainId={CHAIN_ID}
          chainName={chainName(RPC_URL)}
          deployTxHash={contract.deploy_tx_hash}
          createdAt={contract.created_at}
        />

        <StatePanel
          campaignId={id}
          targetEur={contract.target_eur}
          interestBps={contract.interest_bps}
          durationDays={contract.duration_days}
          initial={initialSnapshot}
          updatedAt={contract.updated_at}
        />

        <CashFlowPanel
          state={contract.on_chain_state}
          targetEur={contract.target_eur}
          totalCommittedEur={contract.total_committed_eur}
          totalRepaidEur={contract.total_repaid_eur}
          interestBps={contract.interest_bps}
        />

        <CapTablePanel
          commitments={commitments}
          totalCommittedEur={contract.total_committed_eur}
          interestBps={contract.interest_bps}
        />

        <EventLogPanel events={events} />

        <SourcePanel sources={sources} />

        <SummaryFooter
          owedEur={owedEur}
          targetEur={contract.target_eur}
          totalCommittedEur={contract.total_committed_eur}
          totalRepaidEur={contract.total_repaid_eur}
          interestBps={contract.interest_bps}
        />
      </div>
    </main>
  );
}

function chainName(rpcUrl: string): string {
  if (rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost")) {
    return "Loanly Local (Hardhat)";
  }
  return "Loanly Network";
}

function SummaryFooter({
  owedEur,
  targetEur,
  totalCommittedEur,
  totalRepaidEur,
  interestBps,
}: {
  owedEur: number;
  targetEur: number;
  totalCommittedEur: number;
  totalRepaidEur: number;
  interestBps: number;
}) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-card/60 px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
      Loanly contracts are non-custodial at the contract layer: the
      marketplace holds principal in escrow until either (a) the target is
      hit and funds disburse atomically to the borrower, or (b) the deadline
      passes without funding and every investor can pull back their commit
      via <code>expireIfStale</code>. Once funded, the borrower owes{" "}
      <span className="font-semibold text-foreground">
        {Math.round(owedEur).toLocaleString("en-US")} mEURC
      </span>{" "}
      ({targetEur.toLocaleString("en-US")} principal +{" "}
      {Math.round(owedEur - targetEur).toLocaleString("en-US")} interest at{" "}
      {(interestBps / 100).toFixed(2)}%) and repayments are routed pro-rata to
      every committed wallet automatically. Currently {Math.round(
        totalCommittedEur
      ).toLocaleString("en-US")} principal is committed and{" "}
      {Math.round(totalRepaidEur).toLocaleString("en-US")} has been repaid.
    </p>
  );
}

function NoContractView({
  campaignId,
  title,
}: {
  campaignId: string;
  title: string;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/campaign/${campaignId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <span aria-hidden>←</span>
        Back to campaign
      </Link>
      <header className="mt-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Smart contract explorer
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em]">
          {title}
        </h1>
      </header>
      <div className="mt-8 rounded-xl border border-dashed border-border bg-card/60 p-10 text-center">
        <p className="text-sm font-semibold">No on-chain contract deployed</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The borrower hasn&apos;t initiated the on-chain contract yet. Once
          they do, this page will surface every facet of the deployed escrow:
          identity, cap table, cash flow, events, and source.
        </p>
        <Link
          href={`/campaign/${campaignId}`}
          className="mt-4 inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-1.5 text-xs font-semibold transition hover:bg-accent"
        >
          Back to campaign details
        </Link>
      </div>
    </main>
  );
}
