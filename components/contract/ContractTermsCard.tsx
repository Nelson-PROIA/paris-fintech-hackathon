import Link from "next/link";
import { fmtEur } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { ContractView } from "./types";

const STATUS_VARIANT: Record<
  ContractView["on_chain_state"],
  "success" | "brand" | "warning" | "danger" | "default"
> = {
  open: "success",
  funded: "brand",
  repaying: "warning",
  repaid: "default",
  cancelled: "danger",
};

const STATUS_LABEL: Record<ContractView["on_chain_state"], string> = {
  open: "Open for commitments",
  funded: "Funded — repaying",
  repaying: "Repaying",
  repaid: "Fully repaid",
  cancelled: "Cancelled",
};

function shortHash(hash: string, len = 6): string {
  if (!hash) return "—";
  return `${hash.slice(0, 2 + len)}…${hash.slice(-len)}`;
}

export function ContractTermsCard({
  contract,
  marketplaceAddress,
}: {
  contract: ContractView;
  marketplaceAddress?: string;
}) {
  const interestPct = (contract.interest_bps / 100).toFixed(2);
  const deadline = new Date(contract.commit_deadline);
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            On-chain contract
          </h2>
          <Badge variant={STATUS_VARIANT[contract.on_chain_state]}>
            {STATUS_LABEL[contract.on_chain_state]}
          </Badge>
        </div>
        <Link
          href={`/campaign/${contract.campaign_id}/contract`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold transition hover:border-foreground/30"
        >
          View smart contract
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Term label="Target">{fmtEur(contract.target_eur)}</Term>
        <Term label="Interest">{interestPct}%</Term>
        <Term label="Duration">{contract.duration_days}d</Term>
        <Term label="Commit deadline">
          <span suppressHydrationWarning>
            {deadline.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </Term>
        <Term label="Total committed">
          {fmtEur(contract.total_committed_eur)}
        </Term>
        <Term label="Owed at maturity">{fmtEur(contract.owed_eur)}</Term>
        <Term label="Total repaid">{fmtEur(contract.total_repaid_eur)}</Term>
        <Term label="Borrower">
          <span className="font-mono text-[11px]" title={contract.borrower_address}>
            {shortHash(contract.borrower_address, 4)}
          </span>
        </Term>
      </dl>

      {marketplaceAddress && (
        <p className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>
            Marketplace contract:{" "}
            <span className="font-mono">{shortHash(marketplaceAddress, 6)}</span>
          </span>
          <Link
            href={`/campaign/${contract.campaign_id}/contract`}
            className="text-brand underline-offset-2 hover:underline"
          >
            Open full contract explorer →
          </Link>
        </p>
      )}
    </section>
  );
}

function Term({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums tracking-[-0.015em]">
        {children}
      </dd>
    </div>
  );
}
