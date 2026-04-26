"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { fmtEur } from "@/lib/format";
import type { OnChainState } from "@/lib/db";

const STATUS_VARIANT: Record<
  OnChainState,
  "success" | "brand" | "warning" | "danger" | "default"
> = {
  open: "success",
  funded: "brand",
  repaying: "warning",
  repaid: "default",
  cancelled: "danger",
};

const STATUS_LABEL: Record<OnChainState, string> = {
  open: "Open for commitments",
  funded: "Funded — repaying",
  repaying: "Repaying",
  repaid: "Fully repaid",
  cancelled: "Cancelled",
};

export type StateSnapshot = {
  state: OnChainState;
  totalCommittedEur: number;
  totalRepaidEur: number;
  remainingEur: number;
  fundedAtMs: number | null;
  repaidAtMs: number | null;
  cancelledAtMs: number | null;
  commitDeadlineMs: number;
  investorCount: number;
};

/**
 * Live-state card. Default snapshot is read from the SQLite cache server-side;
 * the "Verify on-chain" button hits an API route that re-reads the marketplace
 * struct via eth_call, reconciles the cache, and returns the freshest values.
 * The two views render side by side so any drift is immediately visible.
 */
export function StatePanel({
  campaignId,
  targetEur,
  interestBps,
  durationDays,
  initial,
  updatedAt,
}: {
  campaignId: string;
  targetEur: number;
  interestBps: number;
  durationDays: number;
  initial: StateSnapshot;
  updatedAt: number;
}) {
  const router = useRouter();
  const [live, setLive] = useState<StateSnapshot | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function verify() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/contract/refresh`, {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      setLive(data.snapshot as StateSnapshot);
      setVerifiedAt(Date.now());
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const view = live ?? initial;
  const drift =
    live != null &&
    (live.totalCommittedEur !== initial.totalCommittedEur ||
      live.totalRepaidEur !== initial.totalRepaidEur ||
      live.state !== initial.state);

  const progressPct =
    targetEur > 0
      ? Math.min(100, Math.round((view.totalCommittedEur / targetEur) * 100))
      : 0;
  const owedEur = view.totalCommittedEur * (1 + interestBps / 10000);
  const repaidPct =
    owedEur > 0
      ? Math.min(100, Math.round((view.totalRepaidEur / owedEur) * 100))
      : 0;

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Live state
          </h2>
          <Badge variant={STATUS_VARIANT[view.state]}>
            {STATUS_LABEL[view.state]}
          </Badge>
          {drift && (
            <Badge variant="warning" className="font-medium">
              Cache drift detected — refreshed
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={verify}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold transition hover:border-foreground/30 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner /> Verifying…
            </>
          ) : (
            <>
              <RefreshIcon /> Verify on-chain
            </>
          )}
        </button>
      </header>

      <div className="space-y-5 p-6">
        {/* Commitment progress */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Committed
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {fmtEur(view.totalCommittedEur)}{" "}
              <span className="text-muted-foreground">/ {fmtEur(targetEur)}</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            {progressPct}% · {view.investorCount} investor
            {view.investorCount === 1 ? "" : "s"} · headroom{" "}
            {fmtEur(view.remainingEur)}
          </p>
        </div>

        {/* Repayment progress (only when relevant) */}
        {(view.state === "funded" ||
          view.state === "repaying" ||
          view.state === "repaid") && (
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Repaid (principal + interest)
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {fmtEur(view.totalRepaidEur)}{" "}
                <span className="text-muted-foreground">
                  / {fmtEur(Math.round(owedEur))}
                </span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-amber-500 transition-[width] duration-500"
                style={{ width: `${repaidPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Key facts grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Target">{fmtEur(targetEur)}</Fact>
          <Fact label="Interest">{(interestBps / 100).toFixed(2)}%</Fact>
          <Fact label="Duration">{durationDays}d</Fact>
          <Fact label="Commit deadline">
            <span suppressHydrationWarning>
              {new Date(view.commitDeadlineMs).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </Fact>
          <Fact label="Funded at">
            {view.fundedAtMs ? <DateValue ts={view.fundedAtMs} /> : "—"}
          </Fact>
          <Fact label="Repaid at">
            {view.repaidAtMs ? <DateValue ts={view.repaidAtMs} /> : "—"}
          </Fact>
          <Fact label="Cancelled at">
            {view.cancelledAtMs ? <DateValue ts={view.cancelledAtMs} /> : "—"}
          </Fact>
          <Fact label="Investor count">{view.investorCount}</Fact>
        </div>
      </div>

      <footer className="border-t border-border px-6 py-3 text-[11px] text-muted-foreground">
        {verifiedAt ? (
          <>
            Verified directly against marketplace contract at{" "}
            <span suppressHydrationWarning>
              {new Date(verifiedAt).toLocaleTimeString("en-GB")}
            </span>
            .
          </>
        ) : (
          <>
            Last cached snapshot:{" "}
            <span suppressHydrationWarning>
              {new Date(updatedAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            . Hit Verify on-chain to read the marketplace struct directly.
          </>
        )}
        {err && (
          <span className="ml-2 text-rose-600 dark:text-rose-400">· {err}</span>
        )}
      </footer>
    </section>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums tracking-[-0.005em]">
        {children}
      </div>
    </div>
  );
}

function DateValue({ ts }: { ts: number }) {
  return (
    <span suppressHydrationWarning>
      {new Date(ts).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}
