import { fmtEur } from "@/lib/format";

function formatTimeLeft(deadlineMs: number): string {
  const diffMs = deadlineMs - Date.now();
  if (diffMs <= 0) return "deadline passed";
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));
  return `${minutes}m left`;
}

export function CommitmentProgress({
  target,
  committed,
  investorCount,
  deadlineMs,
  variant = "card",
}: {
  target: number;
  committed: number;
  investorCount?: number;
  deadlineMs?: number;
  variant?: "card" | "inline";
}) {
  const pct = target > 0 ? Math.min(100, (committed / target) * 100) : 0;
  const remaining = Math.max(0, target - committed);
  const isInline = variant === "inline";

  const bar = (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );

  if (isInline) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] tabular-nums">
          <span className="font-medium">{fmtEur(committed)}</span>
          <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
        </div>
        {bar}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Capital committed
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums tracking-[-0.025em]">
              {fmtEur(committed)}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              / {fmtEur(target)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums tracking-[-0.02em]">
            {pct.toFixed(0)}%
          </div>
          {investorCount != null && (
            <div className="text-[11px] text-muted-foreground">
              {investorCount} {investorCount === 1 ? "investor" : "investors"}
            </div>
          )}
        </div>
      </header>
      <div className="mt-4">{bar}</div>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground tabular-nums">
        <span>{fmtEur(remaining)} remaining</span>
        {deadlineMs != null && <span>{formatTimeLeft(deadlineMs)}</span>}
      </footer>
    </section>
  );
}
