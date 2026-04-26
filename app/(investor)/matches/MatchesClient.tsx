"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MatchedItemHydrated } from "@/lib/ai/match";
import { Badge } from "@/components/ui/badge";
import { SectorIcon } from "@/components/ui/sector-icon";
import { fmtEur, flagFor, humanize } from "@/lib/format";

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
      <StreamProgress stages={stages} status={status} error={error} count={matches.length} />
      {matches.length > 0 && (
        <div className="mb-3 mt-6 flex items-center justify-between text-xs">
          <p className="flex items-center gap-2 text-muted-foreground">
            <span className="font-serif text-base font-semibold tracking-tight text-foreground tabular-nums">
              {matches.length}
            </span>
            {matches.length === 1 ? "match" : "matches"}
            {status === "streaming" && (
              <span className="flex items-center gap-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                </span>
                streaming
              </span>
            )}
            {status === "done" && generatedAt && (
              <span className="text-muted-foreground">
                · {new Date(generatedAt).toLocaleTimeString("en-GB")}
              </span>
            )}
          </p>
          {status === "done" && (
            <button
              type="button"
              onClick={regenerate}
              className="rounded-md border border-border bg-card/60 px-3 py-1 transition hover:border-brand/40 hover:bg-accent"
            >
              Regenerate
            </button>
          )}
        </div>
      )}
      <MatchList matches={matches} animate />
      {status === "done" && matches.length === 0 && (
        <div className="surface-paper mt-8 flex flex-col items-center gap-3 p-10 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">No results</span>
          <p className="font-serif text-lg font-semibold">
            No matches passed the bar this run.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try widening sectors or countries on{" "}
            <Link
              href="/thesis"
              className="text-brand underline-offset-2 hover:underline"
            >
              your thesis
            </Link>
            .
          </p>
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
    <div className="surface mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex h-2 w-2 rounded-full bg-success" />
        <span>
          <span className="font-serif text-base font-semibold tracking-tight text-foreground tabular-nums">
            {count}
          </span>{" "}
          cached {count === 1 ? "match" : "matches"}
        </span>
        {generatedAt && (
          <span className="text-muted-foreground">
            · {new Date(generatedAt).toLocaleString("en-GB")}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={onRegenerate}
        className="gradient-brand inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-soft ring-1 ring-inset ring-white/20 transition hover:brightness-105"
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
  count,
}: {
  stages: Stage[];
  status: string;
  error: string | null;
  count: number;
}) {
  const isLive = status === "streaming";
  return (
    <div className="surface-paper relative overflow-hidden p-6">
      {/* live shimmering top hair line */}
      <div
        className={`absolute inset-x-0 top-0 h-px ${
          isLive
            ? "bg-gradient-to-r from-transparent via-brand to-transparent shimmer"
            : "bg-border"
        }`}
      />
      {/* faint scanning column when live */}
      {isLive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-brand/40 to-transparent"
          style={{ animation: "fade-in-up 1.6s ease-in-out infinite alternate" }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
            isLive ? "gradient-conic animate-spin-slow" : "bg-muted"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-brand">
            <Spark />
          </span>
        </span>
        <h3 className="font-serif text-lg font-semibold tracking-tight">
          AI matching
        </h3>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Mistral Large · live
        </span>
        <Badge
          variant={isLive ? "brand" : status === "done" ? "success" : "default"}
          className="ml-auto px-2.5 py-0.5"
        >
          {isLive ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              streaming
            </>
          ) : status === "done" ? (
            <>✓ complete</>
          ) : (
            "ready"
          )}
        </Badge>
      </div>

      <ol className="relative mt-5 space-y-1">
        {/* connector spine */}
        <span
          className="pointer-events-none absolute left-[9px] top-1 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-border via-border to-transparent"
          aria-hidden
        />
        {stages.map((s, i) => (
          <li
            key={s.id}
            className="relative flex items-start gap-3 rounded-lg px-1 py-2 text-sm"
          >
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
                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.label}
                {s.state === "running" && (
                  <span className="ml-1 inline-flex animate-pulse-soft">…</span>
                )}
              </div>
              {s.detail && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {s.detail}
                </div>
              )}
            </div>
            {s.state === "done" && (
              <span className="text-[10px] uppercase tracking-[0.2em] text-success">
                done
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* count chip while streaming */}
      {isLive && count > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          <span className="font-medium text-foreground tabular-nums">
            {count}
          </span>
          <span className="text-muted-foreground">
            {count === 1 ? "match" : "matches"} arriving live…
          </span>
        </div>
      )}

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
      <span className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success ring-2 ring-card">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  if (state === "running")
    return (
      <span className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ring-2 ring-card">
        <span className="absolute h-5 w-5 animate-ping rounded-full bg-brand/40" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_0_4px_var(--card)]" />
      </span>
    );
  return (
    <span className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ring-2 ring-card">
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
      className="surface group relative flex items-stretch gap-5 overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift"
    >
      {/* Rank gutter */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/10 opacity-0 blur-3xl transition group-hover:opacity-100" />
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand/40 via-brand/10 to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="flex flex-col items-center justify-center gap-2 border-r border-border/60 pr-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          rank
        </span>
        <span className="font-serif text-2xl font-semibold leading-none tabular-nums tracking-tight">
          {String(rank).padStart(2, "0")}
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
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Seeking
            </div>
            <div className="font-serif text-xl font-semibold tabular-nums tracking-tight gradient-headline">
              {fmtEur(m.campaign.capital_seeking_eur)}
            </div>
          </div>
        </div>
        <p className="border-l-2 border-brand/30 pl-3 text-sm leading-relaxed text-foreground/90">
          <span className="font-serif italic text-muted-foreground">
            “
          </span>
          {m.reasoning}
          <span className="font-serif italic text-muted-foreground">
            ”
          </span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="ghost">
            <span>{flagFor(co.country)}</span>
            <span>{co.country ?? "—"}</span>
          </Badge>
          {co.sector && <Badge variant="brand">{humanize(co.sector)}</Badge>}
          {co.stage && <Badge>{humanize(co.stage)}</Badge>}
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand opacity-0 transition group-hover:opacity-100">
            Open deal
            <ArrowSmall />
          </span>
        </div>
      </div>
    </Link>
  );
}

function FitGauge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "from-success to-success/50"
      : score >= 60
        ? "from-brand to-chart-4/60"
        : "from-warning to-warning/50";
  return (
    <div
      className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${tone} shadow-soft`}
    >
      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-card">
        <span className="font-serif text-lg font-semibold leading-none tabular-nums">
          {score}
        </span>
        <span className="mt-0.5 text-[8px] uppercase tracking-[0.22em] text-muted-foreground">
          fit
        </span>
      </div>
    </div>
  );
}

function Spark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
    </svg>
  );
}

function ArrowSmall() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
