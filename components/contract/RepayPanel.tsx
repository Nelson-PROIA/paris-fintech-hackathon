"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtEur } from "@/lib/format";

export function RepayPanel({
  campaignId,
  owedEur,
  totalRepaidEur,
}: {
  campaignId: string;
  owedEur: number;
  totalRepaidEur: number;
}) {
  const router = useRouter();
  const remaining = Math.max(0, owedEur - totalRepaidEur);
  const [amount, setAmount] = useState<string>(String(remaining));
  const [status, setStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chain/wallet", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.balanceEur === "number") {
          setWalletBalance(d.balanceEur);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const numericAmount = Number(amount.replace(/[^0-9]/g, ""));
  const valid =
    Number.isFinite(numericAmount) &&
    numericAmount >= 1 &&
    numericAmount <= remaining;

  async function submit() {
    if (!valid) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountEur: numericAmount }),
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
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Repay investors
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Owed at maturity" value={fmtEur(owedEur)} />
        <Stat label="Repaid so far" value={fmtEur(totalRepaidEur)} />
        <Stat label="Remaining" value={fmtEur(remaining)} />
        <Stat
          label="Wallet balance"
          value={walletBalance == null ? "—" : fmtEur(walletBalance)}
        />
      </div>

      {remaining === 0 ? (
        <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">
          Everyone has been paid back. This campaign is fully repaid.
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[160px]">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Amount (EUR)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-base font-semibold tabular-nums focus:border-foreground/40 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || status === "submitting"}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {status === "submitting" ? "Sending…" : "Repay pro-rata"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}
      {status === "done" && (
        <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          Repayment broadcast. Investors have been credited.
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Each repayment is split pro-rata across investors based on their
        commitment. The platform will top up your wallet with mock EURC if
        you&apos;re short on the interest portion.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
