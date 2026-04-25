"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MatchedItemHydrated } from "@/lib/ai/match";

export function MatchesClient() {
  const [data, setData] = useState<MatchedItemHydrated[] | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    void load(false);
  }, []);

  async function load(force: boolean) {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/match${force ? "?force=1" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json.matches as MatchedItemHydrated[]);
      setGeneratedAt(json.generatedAt);
      setCached(json.cached);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  if (status === "loading" && !data) {
    return (
      <p className="rounded-md border border-border p-6 text-sm text-muted-foreground">
        Generating matches…
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!data || data.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
        No matches for your thesis right now. Try widening sectors or countries on{" "}
        <Link href="/thesis" className="underline-offset-2 hover:underline">
          your thesis
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {data.length} matches · {cached ? "cached" : "fresh"}
          {generatedAt
            ? ` · ${new Date(generatedAt).toLocaleString("en-GB")}`
            : ""}
        </p>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={status === "loading"}
          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
        >
          {status === "loading" ? "Refreshing…" : "Regenerate"}
        </button>
      </div>
      <ul className="space-y-3">
        {data.map((m) => (
          <li key={m.campaignId}>
            <Link
              href={`/campaign/${m.campaignId}`}
              className="block rounded-lg border border-border p-5 transition hover:border-foreground hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      {m.campaign.company.name}
                    </h3>
                    <FitBadge score={m.fitScore} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.campaign.title}
                  </p>
                  <p className="mt-2 text-sm">{m.reasoning}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium">
                    {fmtEur(m.campaign.capital_seeking_eur)}
                  </div>
                  <div className="mt-1 flex flex-wrap justify-end gap-1 text-xs text-muted-foreground">
                    {m.campaign.company.sector && (
                      <span className="rounded bg-secondary px-2 py-0.5">
                        {m.campaign.company.sector}
                      </span>
                    )}
                    {m.campaign.company.country && (
                      <span className="rounded bg-secondary px-2 py-0.5">
                        {m.campaign.company.country}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function FitBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : score >= 60
        ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
        : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
      title="0-100 thesis fit score"
    >
      Fit {score}
    </span>
  );
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
