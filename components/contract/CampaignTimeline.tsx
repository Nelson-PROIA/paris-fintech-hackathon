import { fmtEur } from "@/lib/format";
import type { ChainEventRow } from "@/lib/db";

const KIND_LABEL: Record<string, string> = {
  CampaignCreated: "Contract deployed",
  Committed: "Investor committed",
  Funded: "Target reached — funds disbursed",
  RepaymentReceived: "Partial repayment",
  InvestorPaid: "Investor paid",
  InvestorRefunded: "Investor refunded",
  Repaid: "Fully repaid",
  Cancelled: "Cancelled",
};

const KIND_DOT: Record<string, string> = {
  CampaignCreated: "bg-brand",
  Committed: "bg-emerald-500",
  Funded: "bg-brand",
  RepaymentReceived: "bg-amber-500",
  InvestorPaid: "bg-emerald-500",
  InvestorRefunded: "bg-rose-500",
  Repaid: "bg-emerald-600",
  Cancelled: "bg-rose-500",
};

function shortHash(hash: string, len = 6): string {
  if (!hash) return "";
  return `${hash.slice(0, 2 + len)}…${hash.slice(-len)}`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatLine(event: ChainEventRow): string {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(event.args_json) as Record<string, unknown>;
  } catch {
    /* noop */
  }
  const TOKEN_DECIMALS = 1_000_000;
  const investor = typeof args.investor === "string" ? args.investor : null;
  const amount =
    typeof args.amount === "string" ? Number(args.amount) / TOKEN_DECIMALS : null;
  const totalCommitted =
    typeof args.totalCommitted === "string"
      ? Number(args.totalCommitted) / TOKEN_DECIMALS
      : null;
  const totalRepaid =
    typeof args.totalRepaid === "string"
      ? Number(args.totalRepaid) / TOKEN_DECIMALS
      : null;

  switch (event.kind) {
    case "Committed":
      return `${investor ? shortAddr(investor) : "Investor"} committed ${
        amount != null ? fmtEur(amount) : ""
      } · running total ${
        totalCommitted != null ? fmtEur(totalCommitted) : ""
      }`;
    case "Funded":
      return `Borrower received ${amount != null ? fmtEur(amount) : ""}`;
    case "InvestorPaid":
      return `${investor ? shortAddr(investor) : "Investor"} received ${
        amount != null ? fmtEur(amount) : ""
      }`;
    case "InvestorRefunded":
      return `${investor ? shortAddr(investor) : "Investor"} refunded ${
        amount != null ? fmtEur(amount) : ""
      }`;
    case "RepaymentReceived":
      return `Borrower repaid ${amount != null ? fmtEur(amount) : ""} · total ${
        totalRepaid != null ? fmtEur(totalRepaid) : ""
      }`;
    case "Repaid":
      return `Cycle complete · total repaid ${
        totalRepaid != null ? fmtEur(totalRepaid) : ""
      }`;
    case "CampaignCreated":
      return "Contract deployed and opened for commitments";
    case "Cancelled":
      return "Campaign cancelled — open commitments refunded";
    default:
      return "";
  }
}

export function CampaignTimeline({ events }: { events: ChainEventRow[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Timeline
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No on-chain events yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Timeline
      </h2>
      <ol className="mt-4 space-y-4">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  KIND_DOT[e.kind] ?? "bg-muted-foreground/40"
                }`}
              />
              <span className="mt-1 w-px flex-1 bg-border" />
            </div>
            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold tracking-[-0.005em]">
                  {KIND_LABEL[e.kind] ?? e.kind}
                </span>
                <span
                  className="font-mono text-[10px] text-muted-foreground"
                  title={e.tx_hash}
                >
                  {shortHash(e.tx_hash)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatLine(e)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                <span suppressHydrationWarning>
                  {new Date(e.ts).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="ml-2">block #{e.block_number}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
