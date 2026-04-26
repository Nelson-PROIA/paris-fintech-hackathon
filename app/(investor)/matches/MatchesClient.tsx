"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MatchedItemHydrated } from "@/lib/ai/match";
import { Badge } from "@/components/ui/badge";
import { SectorIcon } from "@/components/ui/sector-icon";
import { fmtEur, humanize } from "@/lib/format";

type ActiveThesis = {
  sectors: string[];
  countries: string[];
  ticketMinEur: number | null;
  ticketMaxEur: number | null;
  riskTolerance: "low" | "medium" | "high";
};

type Stage = {
  id: string;
  label: string;
  state: "pending" | "running" | "done";
  detail?: string;
};

const INITIAL_STAGES: Stage[] = [
  { id: "thesis", label: "Reading your thesis", state: "pending" },
  { id: "filter", label: "Filtering live campaigns", state: "pending" },
  { id: "rank", label: "Ranking deals against your thesis", state: "pending" },
];

export function MatchesClient({
  cachedMatches,
  cachedAt,
  activeThesis,
}: {
  cachedMatches: MatchedItemHydrated[];
  cachedAt: number | null;
  activeThesis: ActiveThesis;
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

  useEffect(() => {
    if (cachedMatches.length === 0) void run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-rank automatically whenever the user saves an updated thesis on this
  // page (the ThesisClient editor lives just above and dispatches this event).
  useEffect(() => {
    function onThesisSaved() {
      regenerate();
    }
    window.addEventListener("loanly:thesis-saved", onThesisSaved);
    return () =>
      window.removeEventListener("loanly:thesis-saved", onThesisSaved);
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
      <StreamProgress
        stages={stages}
        status={status}
        error={error}
        count={matches.length}
      />
      {matches.length > 0 && (
        <div className="mb-3 mt-6 flex items-center justify-between text-xs">
          <p className="flex items-center gap-2 text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {matches.length}
            </span>
            {matches.length === 1 ? "match" : "matches"}
            {status === "streaming" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                </span>
                streaming
              </span>
            )}
            {status === "done" && generatedAt && (
              <span>· {new Date(generatedAt).toLocaleTimeString("en-GB")}</span>
            )}
          </p>
          {status === "done" && (
            <button
              type="button"
              onClick={regenerate}
              className="rounded-md border border-border bg-card px-3 py-1 transition hover:bg-accent"
            >
              Regenerate
            </button>
          )}
        </div>
      )}
      <MatchList matches={matches} animate />
      {status === "done" && matches.length === 0 && (
        <EmptyState
          activeThesis={activeThesis}
          onEdit={openFiltersDrawer}
          onRetry={regenerate}
        />
      )}
      {status === "error" && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">
            Match failed
          </span>
          <p className="text-sm text-muted-foreground">
            Something went wrong while ranking. Try again.
          </p>
          <button
            type="button"
            onClick={regenerate}
            className="mt-1 rounded-md bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            Re-run match
          </button>
        </div>
      )}
    </>
  );
}

function openFiltersDrawer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("loanly:open-filters"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function EmptyState({
  activeThesis,
  onEdit,
  onRetry,
}: {
  activeThesis: ActiveThesis;
  onEdit: () => void;
  onRetry: () => void;
}) {
  const chips: string[] = [];
  if (activeThesis.countries.length > 0)
    chips.push(activeThesis.countries.join(" · "));
  if (activeThesis.sectors.length > 0)
    chips.push(activeThesis.sectors.map(humanize).join(" · "));
  if (activeThesis.ticketMinEur != null || activeThesis.ticketMaxEur != null) {
    const lo = activeThesis.ticketMinEur ?? 0;
    const hi = activeThesis.ticketMaxEur;
    chips.push(
      hi == null ? `≥ ${fmtEur(lo)}` : `${fmtEur(lo)} – ${fmtEur(hi)}`
    );
  }
  if (activeThesis.riskTolerance && activeThesis.riskTolerance !== "medium")
    chips.push(`${activeThesis.riskTolerance} risk`);

  return (
    <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-10 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        No results
      </span>
      <p className="text-base font-semibold">
        No matches passed the bar this run.
      </p>
      {chips.length > 0 ? (
        <div className="flex max-w-md flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Filtering by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {chips.map((chip) => (
              <Badge key={chip} variant="outline" className="font-normal">
                {chip}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Widen one of these to surface more deals.
          </p>
        </div>
      ) : (
        <p className="max-w-sm text-sm text-muted-foreground">
          Set a thesis above to start ranking.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:opacity-90"
        >
          Edit thesis
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-border bg-card px-4 py-1.5 text-xs font-semibold transition hover:bg-accent"
        >
          Re-run match
        </button>
        <Link
          href="/feed"
          className="rounded-md border border-border bg-card px-4 py-1.5 text-xs font-semibold transition hover:bg-accent"
        >
          Browse all deals
        </Link>
      </div>
    </div>
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
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="font-semibold tabular-nums text-foreground">
          {count}
        </span>
        cached {count === 1 ? "match" : "matches"}
        {generatedAt && (
          <span>· {new Date(generatedAt).toLocaleString("en-GB")}</span>
        )}
      </p>
      <button
        type="button"
        onClick={onRegenerate}
        className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90"
      >
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
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold tracking-[-0.01em]">
          AI matching
        </h3>
        <Badge
          variant={isLive ? "brand" : status === "done" ? "success" : "default"}
          className="ml-auto uppercase tracking-[0.16em] text-[10px]"
        >
          {isLive ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              Streaming
            </>
          ) : status === "done" ? (
            "Complete"
          ) : (
            "Ready"
          )}
        </Badge>
      </div>

      <ol className="relative mt-4">
        {/* Continuous spine centered on the 28px dots. Dots punch through it
            via ring-card so the line never breaks but each step still feels
            like a discrete stop. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-4 left-[14px] top-4 w-px bg-border"
        />
        {stages.map((s, i) => (
          <li
            key={s.id}
            className="relative flex items-start gap-3 py-1.5 text-sm"
          >
            <StageDot state={s.state} />
            <div className="flex-1 pt-px">
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
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                Done
              </span>
            )}
          </li>
        ))}
      </ol>

      {isLive && count > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
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
  // Same 28px footprint at every state so the spine is regular. The bg-card
  // ring punches the line behind the dot cleanly (no stubs, no gaps).
  const wrapper =
    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card";
  if (state === "done")
    return (
      <span
        className={`${wrapper} bg-emerald-500/15 text-emerald-600 dark:text-emerald-400`}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
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
      <span className={`${wrapper} bg-brand/15`}>
        <span className="absolute h-3 w-3 animate-ping rounded-full bg-brand/40" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
      </span>
    );
  return (
    <span className={`${wrapper} bg-muted`}>
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
          style={
            animate ? { animationDelay: `${Math.min(i, 8) * 60}ms` } : undefined
          }
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
      className="group flex items-stretch gap-5 rounded-xl border border-border bg-card p-5 transition hover:border-foreground/30"
    >
      <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-2 border-r border-border pr-4">
        <div className="flex flex-col items-center">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            rank
          </span>
          <span className="text-xl font-semibold leading-none tabular-nums tracking-[-0.02em]">
            {String(rank).padStart(2, "0")}
          </span>
        </div>
        <FitChip score={m.fitScore} />
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SectorIcon sector={co.sector} size="md" />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold leading-tight tracking-[-0.01em]">
                {co.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {m.campaign.title}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Seeking
            </div>
            <div className="text-lg font-semibold tabular-nums tracking-[-0.02em]">
              {fmtEur(m.campaign.capital_seeking_eur)}
            </div>
          </div>
        </div>
        <p className="border-l-2 border-border pl-3 text-sm leading-relaxed text-foreground/90">
          {m.reasoning}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{co.country ?? "—"}</Badge>
          {co.sector && <Badge variant="brand">{humanize(co.sector)}</Badge>}
          {co.stage && <Badge>{humanize(co.stage)}</Badge>}
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-foreground opacity-0 transition group-hover:opacity-100">
            Open deal
            <ArrowSmall />
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Fit badge: a complete colored ring around the score, tier-coloured.
 * No partial gauge — just a solid filled circle disc.
 */
function FitChip({ score }: { score: number }) {
  const tier =
    score >= 80
      ? { label: "Strong", text: "text-emerald-700 dark:text-emerald-400", ring: "border-emerald-500", bg: "bg-emerald-500/10" }
      : score >= 60
        ? { label: "Good", text: "text-brand", ring: "border-brand", bg: "bg-brand/10" }
        : score >= 40
          ? { label: "Marginal", text: "text-amber-700 dark:text-amber-400", ring: "border-amber-500", bg: "bg-amber-500/10" }
          : { label: "Low", text: "text-rose-700 dark:text-rose-400", ring: "border-rose-500", bg: "bg-rose-500/10" };

  return (
    <span className="group/fit relative">
      <span
        className={`flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 ${tier.ring} ${tier.bg} ${tier.text}`}
      >
        <span className="text-sm font-semibold leading-none tabular-nums">
          {score}
        </span>
        <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.16em] opacity-80">
          fit
        </span>
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-30 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-left text-[11px] shadow-lg opacity-0 transition group-hover/fit:opacity-100"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Fit · {tier.label}
        </span>
        <span className="mt-1 block text-foreground">
          0–100 score against your thesis: sector + country + stage + ticket fit + traction signals.
        </span>
        <span className="mt-1.5 block text-muted-foreground">
          80+ strong · 60–80 good · 40–60 marginal · below low.
        </span>
      </span>
    </span>
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
