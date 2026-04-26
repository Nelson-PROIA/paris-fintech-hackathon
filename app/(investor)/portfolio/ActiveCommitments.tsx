import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CommitmentProgress } from "@/components/contract/CommitmentProgress";
import { fmtEur } from "@/lib/format";
import { computeOwedEur } from "@/lib/chain/marketplace";
import {
  getCampaignWithCompany,
  getCampaignContract,
  listCommitmentsByInvestor,
  type CampaignContractRow,
  type CommitmentRow,
} from "@/lib/db";

const STATE_LABEL: Record<CampaignContractRow["on_chain_state"], string> = {
  open: "Open",
  funded: "Funded",
  repaying: "Repaying",
  repaid: "Repaid",
  cancelled: "Cancelled",
};

const STATE_VARIANT: Record<
  CampaignContractRow["on_chain_state"],
  "success" | "brand" | "warning" | "danger" | "default"
> = {
  open: "success",
  funded: "brand",
  repaying: "warning",
  repaid: "default",
  cancelled: "danger",
};

const COMMIT_LABEL: Record<CommitmentRow["status"], string> = {
  committed: "Awaiting funding",
  refunded: "Refunded",
  repaid_partial: "Partially repaid",
  repaid: "Fully repaid",
};

export function ActiveCommitments({ userId }: { userId: string }) {
  const commitments = listCommitmentsByInvestor(userId);
  if (commitments.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Active commitments
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You haven&apos;t committed to any campaign yet. Pick a deal from the
          feed and click <span className="font-medium">Commit capital</span>.
        </p>
      </section>
    );
  }

  const totalStake = commitments.reduce((s, c) => s + c.amount_eur, 0);
  const totalReceived = commitments.reduce(
    (s, c) => s + c.repaid_amount_eur,
    0
  );

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Active commitments
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {commitments.length} on-chain{" "}
            {commitments.length === 1 ? "stake" : "stakes"}
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Total staked
            </div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-[-0.02em]">
              {fmtEur(totalStake)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Repaid so far
            </div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-[-0.02em]">
              {fmtEur(totalReceived)}
            </div>
          </div>
        </div>
      </header>

      <ul className="mt-5 space-y-3">
        {commitments.map((c) => {
          const camp = getCampaignWithCompany(c.campaign_id);
          const contract = getCampaignContract(c.campaign_id);
          if (!camp) return null;
          const interestBps = contract?.interest_bps ?? 0;
          const expectedReturn = computeOwedEur(c.amount_eur, interestBps);
          return (
            <li key={c.id}>
              <Link
                href={`/campaign/${c.campaign_id}`}
                className="block rounded-lg border border-border bg-background/40 p-4 transition hover:border-foreground/30"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {camp.company.name}
                    </span>
                    <h3 className="mt-0.5 text-base font-semibold tracking-[-0.005em]">
                      {camp.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {contract && (
                      <Badge variant={STATE_VARIANT[contract.on_chain_state]}>
                        {STATE_LABEL[contract.on_chain_state]}
                      </Badge>
                    )}
                    <Badge variant="ghost">{COMMIT_LABEL[c.status]}</Badge>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <Metric label="Your stake" value={fmtEur(c.amount_eur)} />
                  <Metric
                    label="Expected at maturity"
                    value={fmtEur(expectedReturn)}
                  />
                  <Metric
                    label="Received so far"
                    value={fmtEur(c.repaid_amount_eur)}
                  />
                </div>
                {contract && (
                  <div className="mt-3">
                    <CommitmentProgress
                      variant="inline"
                      target={contract.target_eur}
                      committed={contract.total_committed_eur}
                    />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
