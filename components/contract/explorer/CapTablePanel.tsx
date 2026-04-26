import type { CommitmentRow } from "@/lib/db";
import { fmtEur } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "./CopyButton";

const STATUS_VARIANT: Record<
  CommitmentRow["status"],
  "success" | "brand" | "warning" | "danger" | "default"
> = {
  committed: "success",
  refunded: "danger",
  repaid_partial: "warning",
  repaid: "brand",
};

const STATUS_LABEL: Record<CommitmentRow["status"], string> = {
  committed: "Committed",
  refunded: "Refunded",
  repaid_partial: "Partial repaid",
  repaid: "Repaid",
};

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortHash(h: string): string {
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

/**
 * Per-investor breakdown — every commitment that ever hit the contract,
 * plus their share of the principal, expected return at maturity, and
 * actual amount received so far. Aligns with the events visible in
 * the timeline.
 */
export function CapTablePanel({
  commitments,
  totalCommittedEur,
  interestBps,
}: {
  commitments: CommitmentRow[];
  totalCommittedEur: number;
  interestBps: number;
}) {
  if (commitments.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Cap table
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No commitments yet — investors haven&apos;t funded this campaign.
        </p>
      </section>
    );
  }

  const total = commitments.reduce((acc, c) => acc + c.amount_eur, 0);
  const repaidAggregate = commitments.reduce(
    (acc, c) => acc + c.repaid_amount_eur,
    0
  );

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Cap table
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every wallet that committed, with its share of the principal and
            expected return.
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {commitments.length} commitment{commitments.length === 1 ? "" : "s"} ·
          principal {fmtEur(total)} · received {fmtEur(repaidAggregate)}
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60 text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-6 py-2 font-medium">Investor</th>
              <th className="px-3 py-2 text-right font-medium">Principal</th>
              <th className="px-3 py-2 text-right font-medium">Share</th>
              <th className="px-3 py-2 text-right font-medium">
                Expected
                <span className="ml-1 text-[9px] normal-case">at maturity</span>
              </th>
              <th className="px-3 py-2 text-right font-medium">Received</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-6 py-2 font-medium">Tx</th>
            </tr>
          </thead>
          <tbody>
            {commitments.map((c) => {
              const share =
                totalCommittedEur > 0 ? c.amount_eur / totalCommittedEur : 0;
              const expected = c.amount_eur * (1 + interestBps / 10000);
              return (
                <tr
                  key={c.id}
                  className="border-b border-border/60 last:border-0 hover:bg-accent/40"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <code
                        className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px]"
                        title={c.investor_address}
                      >
                        {shortAddr(c.investor_address)}
                      </code>
                      <CopyButton value={c.investor_address} label="" />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                      <span suppressHydrationWarning>
                        {new Date(c.committed_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {fmtEur(c.amount_eur)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {(share * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                    {fmtEur(Math.round(expected))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {c.repaid_amount_eur > 0
                      ? fmtEur(c.repaid_amount_eur)
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={STATUS_VARIANT[c.status]}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <code
                        className="font-mono text-[10px] text-muted-foreground"
                        title={c.tx_hash}
                      >
                        {shortHash(c.tx_hash)}
                      </code>
                      <CopyButton value={c.tx_hash} label="" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
