"use client";

import { useEffect, useState } from "react";
import { fmtEur } from "@/lib/format";

type WalletState =
  | { status: "loading" }
  | { status: "ok"; address: string; balanceEur: number }
  | { status: "offline"; message: string }
  | { status: "error"; message: string };

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletPill() {
  const [state, setState] = useState<WalletState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/chain/wallet", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 503) {
          setState({
            status: "offline",
            message: data.message ?? "Chain offline",
          });
          return;
        }
        if (!res.ok) {
          setState({
            status: "error",
            message: data.message ?? data.error ?? "Wallet error",
          });
          return;
        }
        setState({
          status: "ok",
          address: data.address,
          balanceEur: data.balanceEur,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <span className="hidden items-center rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline-flex">
        wallet…
      </span>
    );
  }
  if (state.status === "offline") {
    return (
      <span
        title={state.message}
        className="hidden items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-rose-700 dark:text-rose-300 sm:inline-flex"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
        Chain offline
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span
        title={state.message}
        className="hidden items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300 sm:inline-flex"
      >
        wallet error
      </span>
    );
  }
  return (
    <span
      title={state.address}
      className="hidden items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-foreground sm:inline-flex"
    >
      <span className="font-mono text-[10px] text-muted-foreground">
        {shortAddr(state.address)}
      </span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <span>{fmtEur(state.balanceEur)}</span>
    </span>
  );
}
