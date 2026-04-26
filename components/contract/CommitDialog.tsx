"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtEur } from "@/lib/format";

type WalletInfo = {
  address: string;
  balanceEur: number;
};

export function CommitDialog({
  campaignId,
  remainingEur,
  interestBps,
  durationDays,
}: {
  campaignId: string;
  remainingEur: number;
  interestBps: number;
  durationDays: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!open || wallet) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chain/wallet", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "wallet_error");
        if (!cancelled) setWallet({ address: data.address, balanceEur: data.balanceEur });
      } catch (e) {
        if (!cancelled) {
          setWalletErr(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, wallet]);

  const max = useMemo(() => {
    const balance = wallet?.balanceEur ?? 0;
    return Math.max(0, Math.floor(Math.min(remainingEur, balance)));
  }, [remainingEur, wallet]);

  const numericAmount = Number(amount.replace(/[^0-9]/g, ""));
  const amountValid = Number.isFinite(numericAmount) && numericAmount >= 1 && numericAmount <= max;
  const expectedReturn = amountValid ? numericAmount * (1 + interestBps / 10000) : 0;
  const netGain = expectedReturn - numericAmount;

  async function submit() {
    if (!amountValid) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountEur: numericAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      setTxHash(data.txHash);
      setStatus("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Commit capital
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={() => status !== "submitting" && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold tracking-[-0.015em]">
              Commit to this campaign
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Funds are pulled from your custodial wallet via the marketplace
              contract. If the target is reached, the SMB is funded
              automatically.
            </p>

            {walletErr && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {walletErr}
              </div>
            )}
            {!wallet && !walletErr && (
              <div className="mt-4 text-xs text-muted-foreground">
                Loading wallet…
              </div>
            )}

            {wallet && (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <Stat label="Wallet balance" value={fmtEur(wallet.balanceEur)} />
                  <Stat label="Remaining target" value={fmtEur(remainingEur)} />
                </div>

                <label className="mt-5 block">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Amount (EUR)
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="0"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold tabular-nums focus:border-foreground/40 focus:outline-none"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>min €1</span>
                    <button
                      type="button"
                      onClick={() => setAmount(String(max))}
                      className="hover:text-foreground"
                    >
                      max {fmtEur(max)}
                    </button>
                  </div>
                </label>

                {amountValid && (
                  <div className="mt-4 rounded-md border border-brand/30 bg-brand-muted/40 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Principal — what you commit now
                      </span>
                      <span className="font-semibold tabular-nums">
                        {fmtEur(numericAmount)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">
                        Interest — your profit ({(interestBps / 100).toFixed(2)}% · {durationDays}d)
                      </span>
                      <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                        +{fmtEur(netGain)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-brand/30 pt-2">
                      <span className="text-foreground">
                        You receive at maturity
                      </span>
                      <span className="font-semibold tabular-nums">
                        {fmtEur(expectedReturn)}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                      Flat rate over the term, paid in mEURC when the borrower
                      repays. Pro-rated to your share if multiple investors
                      commit.
                    </p>
                  </div>
                )}

                {status === "done" && txHash && (
                  <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Committed — tx confirmed
                    </div>
                    <div
                      className="mt-1 truncate font-mono text-[10px] text-muted-foreground"
                      title={txHash}
                    >
                      {txHash}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                    {error}
                  </div>
                )}
              </>
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
                  disabled={!amountValid || status === "submitting" || !wallet}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {status === "submitting"
                    ? "Signing & committing…"
                    : "Sign & commit"}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
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
