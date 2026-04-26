"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtEur } from "@/lib/format";

export function InitiateContractDialog({
  campaignId,
  targetEur,
}: {
  campaignId: string;
  targetEur: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [interestPct, setInterestPct] = useState("8");
  const [duration, setDuration] = useState("90");
  const [deadline, setDeadline] = useState("30");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const interestNum = Number(interestPct);
  const durationNum = Number(duration);
  const deadlineNum = Number(deadline);
  const valid =
    Number.isFinite(interestNum) &&
    interestNum >= 0 &&
    interestNum <= 50 &&
    Number.isFinite(durationNum) &&
    durationNum >= 1 &&
    durationNum <= 3650 &&
    Number.isFinite(deadlineNum) &&
    deadlineNum >= 1 &&
    deadlineNum <= 365;

  const expectedRepay = valid ? targetEur * (1 + interestNum / 100) : 0;

  async function submit() {
    if (!valid) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interestBps: Math.round(interestNum * 100),
          durationDays: durationNum,
          commitDeadlineDays: deadlineNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      setStatus("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <>
      <section className="rounded-xl border border-dashed border-border bg-card/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Smart contract
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          This campaign isn&apos;t live on-chain yet. Initiate a smart contract
          to open it for commitments. The factory escrow holds investor funds
          until your target ({fmtEur(targetEur)}) is reached, then auto-disburses
          to your wallet.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Initiate on-chain contract
          </button>
        </div>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={() => status !== "submitting" && setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold tracking-[-0.015em]">
              Initiate smart contract
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              These terms are encoded into the marketplace contract on
              creation. They cannot be changed afterwards — investors commit
              against the terms shown.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <Field
                label="Interest %"
                hint="bps × 100"
                value={interestPct}
                onChange={setInterestPct}
              />
              <Field
                label="Duration (d)"
                hint="loan term"
                value={duration}
                onChange={setDuration}
              />
              <Field
                label="Deadline (d)"
                hint="time to fund"
                value={deadline}
                onChange={setDeadline}
              />
            </div>

            <div className="mt-5 rounded-md border border-brand/30 bg-brand-muted/40 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  You receive on full funding
                </span>
                <span className="font-semibold tabular-nums">
                  {fmtEur(targetEur)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">
                  Owed at maturity ({durationNum}d)
                </span>
                <span className="font-semibold tabular-nums">
                  {fmtEur(Math.round(expectedRepay))}
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </div>
            )}
            {status === "done" && (
              <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                Contract deployed.
              </div>
            )}

            <footer className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={status === "submitting"}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {status === "done" ? "Close" : "Cancel"}
              </button>
              {status !== "done" && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!valid || status === "submitting"}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {status === "submitting"
                    ? "Deploying contract…"
                    : "Deploy contract"}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-base font-semibold tabular-nums focus:border-foreground/40 focus:outline-none"
      />
      {hint && (
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}
