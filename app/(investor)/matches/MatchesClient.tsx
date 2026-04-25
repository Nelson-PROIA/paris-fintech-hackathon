"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MatchedItemHydrated } from "@/lib/ai/match";
import { Badge } from "@/components/ui/badge";
import { SectorIcon } from "@/components/ui/sector-icon";
import { fmtEur, flagFor } from "@/lib/format";

type Stage = {
  id: string;
  label: string;
  state: "pending" | "running" | "done";
  detail?: string;
};

const INITIAL_STAGES: Stage[] = [
  { id: "thesis", label: "Reading your thesis", state: "pending" },
  { id: "filter", label: "Filtering live campaigns", state: "pending" },
  { id: "rank", label: "Mistral Large is ranking deals", state: "pending" },
];

export function MatchesClient({
  cachedMatches,
  cachedAt,
}: {
  cachedMatches: MatchedItemHydrated[];
  cachedAt: number | null;
}) {
  const [showCache, setShowCache] = useState(cachedMatches.length > 0);
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [matches, setMatches] = useState<MatchedItemHydrated[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(cachedAt);
  const abortRef = useRef<AbortController | null>(null);

  function regenerate() {
    setShowCache(false);
    void run();
  }

  // Auto-run on mount if no cache
  useEffect(() => {
    if (cachedMatches.length === 0) void run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setStatus("streaming");
    setError(null);
    setMatches([]);
    setStages(INITIAL_STAGES);

    try {
      const res = await fetch("/api/match/stream", { signal: ac.signal });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line));
        }
      }
      if (buffer.trim()) handleEvent(JSON.parse(buffer));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  function handleEvent(ev: any) {
    if (ev.type === "stage") {
      setStages((prev) =>
        prev.map((s) =>
          s.id === ev.id ? { ...s, state: "running", label: ev.label } : s
        )
      );
    } else if (ev.type === "stage:done") {
      setStages((prev) =>
        prev.map((s) =>
          s.id === ev.id ? { ...s, state: "done", detail: ev.detail } : s
        )
      );
    } else if (ev.type === "match") {
      setMatches((prev) => [...prev, ev.item as MatchedItemHydrated]);
    } else if (ev.type === "done") {
      setGeneratedAt(ev.generatedAt);
      setStatus("done");
    } else if (ev.type === "error") {
      setError(ev.message);
      setStatus("error");
    }
  }

  // Show cached results until user regenerates
  if (showCache) {
    return (
      <>
        <CacheHeader
          count={cachedMatches.length}
          generatedAt={cachedAt}
          onRegenerate={regenerate}
        />
        <MatchList matches={cachedMatches} animate={false} />
      </>
    );
  }

  return (
    <>
      <StreamProgress stages={stages} status={status} error={error} />
      {matches.length > 0 && (
        <div className="mb-3 mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
            {status === "streaming" && " streaming…"}
            {status === "done" && generatedAt
              ? ` · ${new Date(generatedAt).toLocaleTimeString("en-GB")}`
              : ""}
          </p>
          {status === "done" && (
            <button
              type="button"
              onClick={regenerate}
              className="rounded-md border border-border bg-card/60 px-3 py-1 text-xs hover:bg-accent"
            >
              Regenerate
            </button>
          )}
        </div>
      )}
      <MatchList matches={matches} animate />
      {status === "done" && matches.length === 0 && (
        <div className="surface mt-8 p-8 text-center text-sm text-muted-foreground">
          No matches passed the bar this run. Try widening sectors or countries on{" "}
          <Link href="/thesis" className="text-brand underline-offset-2 hover:underline">
            your thesis
          </Link>
          .
        </div>
      )}
    </>
  );
}

function CacheHeader({
  count,
  generatedAt,
  onRegenerate,
}: {
  count: number;
  generatedAt: number | null;
  onRegenerate: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        {count} cached {count === 1 ? "match" : "matches"}
        {generatedAt ? ` · ${new Date(generatedAt).toLocaleString("en-GB")}` : ""}
      </p>
      <button
        type="button"
        onClick={onRegenerate}
        className="gradient-brand inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-soft ring-1 ring-inset ring-white/20 hover:brightness-105"
      >
        <Spark />
        Regenerate live
      </button>
    </div>
  );
}

function StreamProgress({
  stages,
  status,
  error,
}: {
  stages: Stage[];
  status: string;
  error: string | null;
}) {
  return (
    <div className="surface relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent" />
      <div className="flex items-center gap-2">
        <Spark />
        <h3 className="text-sm font-semibold tracking-tight">
          Live AI matching
        </h3>
        <Badge variant="brand" className="ml-auto">
          {status === "streaming" ? "in progress" : status === "done" ? "complete" : "ready"}
        </Badge>
      </div>
      <ul className="mt-4 space-y-2.5">
        {stages.map((s) => (
          <li key={s.id} className="flex items-start gap-3 text-sm">
            <StageDot state={s.state} />
            <div className="flex-1">
              <div
                className={
                  s.state === "running"
                    ? "font-medium text-foreground"
                    : s.state === "done"
                      ? "text-foreground"
                      : "text-muted-foreground"
                }
              >
                {s.label}
                {s.state === "running" && (
                  <span className="ml-1 inline-flex">
                    <span className="animate-pulse-soft">…</span>
                  </span>
                )}
              </div>
              {s.detail && (
                <div className="text-xs text-muted-foreground">{s.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function StageDot({ state }: { state: Stage["state"] }) {
  if (state === "done")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  if (state === "running")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="absolute h-5 w-5 animate-ping rounded-full bg-brand/40" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
      </span>
    );
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
      <span className="h-2 w-2 rounded-full border border-border bg-card" />
    </span>
  );
}

function MatchList({
  matches,
  animate,
}: {
  matches: MatchedItemHydrated[];
  animate: boolean;
}) {
  if (matches.length === 0) return null;
  return (
    <ul className="space-y-3">
      {matches.map((m, i) => (
        <li
          key={m.campaignId}
          className={animate ? "animate-fade-in-up" : ""}
          style={animate ? { animationDelay: `${Math.min(i, 8) * 60}ms` } : undefined}
        >
          <MatchCard m={m} rank={i + 1} />
        </li>
      ))}
    </ul>
  );
}

function MatchCard({ m, rank }: { m: MatchedItemHydrated; rank: number }) {
  const co = m.campaign.company;
  return (
    <Link
      href={`/campaign/${m.campaignId}`}
      className="surface group relative flex items-stretch gap-4 overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/10 opacity-0 blur-3xl transition group-hover:opacity-100" />
      <div className="flex flex-col items-center gap-2 pr-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          #{String(rank).padStart(2, "0")}
        </span>
        <FitGauge score={m.fitScore} />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SectorIcon sector={co.sector} size="md" />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold leading-tight">
                {co.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {m.campaign.title}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Seeking
            </div>
            <div className="gradient-text text-lg font-semibold tabular-nums">
              {fmtEur(m.campaign.capital_seeking_eur)}
            </div>
          </div>
        </div>
        <p className="text-sm leading-relaxed">{m.reasoning}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="ghost">
            <span>{flagFor(co.country)}</span>
            <span>{co.country ?? "—"}</span>
          </Badge>
          {co.sector && <Badge variant="brand">{co.sector}</Badge>}
          {co.stage && <Badge>{co.stage}</Badge>}
        </div>
      </div>
    </Link>
  );
}

function FitGauge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "from-success to-success/60 text-success"
      : score >= 60
        ? "from-brand to-brand/60 text-brand"
        : "from-warning to-warning/60 text-warning";
  return (
    <div
      className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${tone} bg-clip-padding`}
    >
      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-card">
        <span className="text-lg font-semibold leading-none tabular-nums">
          {score}
        </span>
        <span className="mt-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
          fit
        </span>
      </div>
    </div>
  );
}

function Spark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-brand">
      <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
    </svg>
  );
}
