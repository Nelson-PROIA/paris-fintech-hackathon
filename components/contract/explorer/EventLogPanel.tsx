"use client";

import { useState } from "react";
import type { ChainEventRow } from "@/lib/db";
import { fmtEur } from "@/lib/format";
import { CopyButton } from "./CopyButton";

const KIND_LABEL: Record<string, string> = {
  CampaignCreated: "Contract deployed",
  Committed: "Investor committed",
  Funded: "Target reached — funds disbursed",
  RepaymentReceived: "Partial repayment received",
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

const TOKEN_DECIMALS_DIVISOR = 1_000_000;

function shortHash(h: string, n = 6): string {
  return `${h.slice(0, 2 + n)}…${h.slice(-n)}`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function summary(event: ChainEventRow): string {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(event.args_json) as Record<string, unknown>;
  } catch {
    /* noop */
  }
  const investor = typeof args.investor === "string" ? args.investor : null;
  const amount =
    typeof args.amount === "string"
      ? Number(args.amount) / TOKEN_DECIMALS_DIVISOR
      : null;
  const totalCommitted =
    typeof args.totalCommitted === "string"
      ? Number(args.totalCommitted) / TOKEN_DECIMALS_DIVISOR
      : null;
  const totalRepaid =
    typeof args.totalRepaid === "string"
      ? Number(args.totalRepaid) / TOKEN_DECIMALS_DIVISOR
      : null;

  switch (event.kind) {
    case "Committed":
      return `${investor ? shortAddr(investor) : "Investor"} committed ${
        amount != null ? fmtEur(amount) : "—"
      } · running total ${
        totalCommitted != null ? fmtEur(totalCommitted) : "—"
      }`;
    case "Funded":
      return `Borrower received ${amount != null ? fmtEur(amount) : "—"}`;
    case "InvestorPaid":
      return `${investor ? shortAddr(investor) : "Investor"} received ${
        amount != null ? fmtEur(amount) : "—"
      }`;
    case "InvestorRefunded":
      return `${investor ? shortAddr(investor) : "Investor"} refunded ${
        amount != null ? fmtEur(amount) : "—"
      }`;
    case "RepaymentReceived":
      return `Borrower repaid ${amount != null ? fmtEur(amount) : "—"} · total ${
        totalRepaid != null ? fmtEur(totalRepaid) : "—"
      }`;
    case "Repaid":
      return `Cycle complete · total repaid ${
        totalRepaid != null ? fmtEur(totalRepaid) : "—"
      }`;
    case "CampaignCreated":
      return "Contract deployed and opened for commitments";
    case "Cancelled":
      return "Campaign cancelled — open commitments refunded";
    default:
      return "";
  }
}

function prettyArgs(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

/**
 * Full event log of every Solidity event emitted for this campaign, in
 * chronological order. Each row shows the human-readable summary, the tx hash,
 * block number, log index, and an expandable raw-args inspector for full
 * verification.
 */
export function EventLogPanel({ events }: { events: ChainEventRow[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Event log
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No on-chain events emitted yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Event log
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every Solidity event emitted for this campaign. Click any row to
            see the raw decoded arguments.
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </header>

      <ol className="divide-y divide-border">
        {events.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </ol>
    </section>
  );
}

function EventRow({ event }: { event: ChainEventRow }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="flex items-start gap-3 px-6 py-3">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            KIND_DOT[event.kind] ?? "bg-muted-foreground/40"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-semibold">
              {KIND_LABEL[event.kind] ?? event.kind}
              <code className="ml-2 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {event.kind}
              </code>
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              <span suppressHydrationWarning>
                {new Date(event.ts).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="ml-2">block #{event.block_number}</span>
              <span className="ml-2">log #{event.log_index}</span>
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summary(event)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <code className="font-mono text-[10px]" title={event.tx_hash}>
              tx {shortHash(event.tx_hash)}
            </code>
            <CopyButton value={event.tx_hash} label="" />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="ml-auto rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition hover:border-foreground/30 hover:text-foreground"
              aria-expanded={open}
            >
              {open ? "Hide raw" : "Show raw"}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background/60 px-6 py-3">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-card p-3 font-mono text-[11px] leading-relaxed">
            {prettyArgs(event.args_json)}
          </pre>
        </div>
      )}
    </li>
  );
}
