"use client";

import { useRef, useState } from "react";
import { DDBriefView } from "@/components/DDBrief";
import type { DDBrief } from "@/lib/ai/dd-analyst";
import { Badge } from "@/components/ui/badge";

type LoadedBrief = { brief: DDBrief; generatedAt: number; cached: boolean };

type ToolEvent = {
  stepIndex: number;
  tool: "webSearch" | "fetchUrl" | "companyLookup";
  input: unknown;
  state: "running" | "done";
  summary?: string;
};

type StageState = {
  id: "research" | "structure";
  label: string;
  state: "pending" | "running" | "done";
  detail?: string;
};

const INITIAL_STAGES: StageState[] = [
  { id: "research", label: "Researching the company online", state: "pending" },
  { id: "structure", label: "Structuring the brief", state: "pending" },
];

export function DDSection({
  companyId,
  initialBrief,
}: {
  companyId: string;
  initialBrief: LoadedBrief | null;
}) {
  const [data, setData] = useState<LoadedBrief | null>(initialBrief);
  const [stages, setStages] = useState<StageState[]>(INITIAL_STAGES);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [showStream, setShowStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function reset() {
    setStages(INITIAL_STAGES);
    setToolEvents([]);
    setError(null);
  }

  async function generate() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    reset();
    setStreaming(true);
    setShowStream(true);
    setData(null);

    try {
      const res = await fetch(`/api/company/${companyId}/dd/stream`, {
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
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
    } finally {
      setStreaming(false);
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
    } else if (ev.type === "tool:call") {
      setToolEvents((prev) => [
        ...prev,
        {
          stepIndex: ev.stepIndex,
          tool: ev.tool,
          input: ev.input,
          state: "running",
        },
      ]);
    } else if (ev.type === "tool:result") {
      setToolEvents((prev) =>
        prev.map((t) =>
          t.stepIndex === ev.stepIndex
            ? { ...t, state: "done", summary: ev.summary }
            : t
        )
      );
    } else if (ev.type === "brief") {
      setData({ brief: ev.brief, generatedAt: ev.generatedAt, cached: false });
    } else if (ev.type === "error") {
      setError(ev.message);
    }
  }

  // No brief yet — show CTA
  if (!data && !showStream) {
    return (
      <section className="surface-paper relative overflow-hidden p-7">
        <div className="pointer-events-none absolute inset-0 gradient-mesh opacity-35" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative">
          <Badge variant="brand" className="mb-3 px-3 py-1">
            <Spark />
            Agent on demand
          </Badge>
          <h3 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">
            One-page DD brief, in{" "}
            <span className="serif-italic gradient-headline">
              &lt; 30 seconds.
            </span>
          </h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            An AI analyst hits the web, reads the company website, checks the
            SIRENE registry if French, and structures findings into a brief
            with risk flags and cited sources. Watch it work live.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generate}
              className="gradient-brand inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-lift ring-1 ring-inset ring-white/20 transition hover:brightness-105 active:translate-y-px"
            >
              <Spark />
              Run DD agent
            </button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-card/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]">
                Web search
              </span>
              <span className="rounded-full border border-border bg-card/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]">
                Page fetch
              </span>
              <span className="rounded-full border border-border bg-card/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]">
                SIRENE lookup
              </span>
            </span>
          </div>
          {error && (
            <p className="mt-3 text-sm text-destructive">Error: {error}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {(streaming || (showStream && !data)) && (
        <AgentLog stages={stages} events={toolEvents} streaming={streaming} />
      )}
      {data && (
        <>
          {showStream && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Show agent trace ({toolEvents.length} tool calls)
              </summary>
              <div className="mt-2">
                <AgentLog stages={stages} events={toolEvents} streaming={false} />
              </div>
            </details>
          )}
          <DDBriefView
            brief={data.brief}
            generatedAt={data.generatedAt}
            cached={data.cached}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={streaming}
              className="rounded-md border border-border bg-card/60 px-4 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
            >
              {streaming ? "Regenerating…" : "Regenerate live"}
            </button>
            {error && <p className="text-xs text-destructive">Error: {error}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function AgentLog({
  stages,
  events,
  streaming,
}: {
  stages: StageState[];
  events: ToolEvent[];
  streaming: boolean;
}) {
  return (
    <div className="surface-paper relative overflow-hidden p-5">
      <div
        className={`absolute inset-x-0 top-0 h-px ${
          streaming
            ? "bg-gradient-to-r from-transparent via-brand to-transparent shimmer"
            : "bg-border"
        }`}
      />
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
            streaming ? "gradient-conic animate-spin-slow" : "bg-muted"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-brand">
            <Spark />
          </span>
        </span>
        <h3 className="font-serif text-base font-semibold tracking-tight">
          DD Agent
        </h3>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          tool trace
        </span>
        <Badge variant={streaming ? "brand" : "default"} className="ml-auto">
          {streaming ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              live
            </>
          ) : (
            "trace"
          )}
        </Badge>
      </div>

      <ul className="mt-4 space-y-3">
        {stages.map((s) => (
          <li key={s.id}>
            <div className="flex items-start gap-3">
              <StageDot state={s.state} />
              <div className="flex-1">
                <div
                  className={
                    s.state === "running"
                      ? "text-sm font-medium"
                      : s.state === "done"
                        ? "text-sm"
                        : "text-sm text-muted-foreground"
                  }
                >
                  {s.label}
                  {s.state === "running" && (
                    <span className="ml-1 animate-pulse-soft">…</span>
                  )}
                </div>
                {s.detail && (
                  <div className="text-xs text-muted-foreground">{s.detail}</div>
                )}
              </div>
            </div>
            {s.id === "research" &&
              (s.state !== "pending" || events.length > 0) && (
                <ul className="ml-7 mt-2 space-y-1.5 border-l border-border/60 pl-4">
                  {events.map((ev) => (
                    <li
                      key={ev.stepIndex}
                      className="animate-fade-in-up flex items-start gap-2 text-xs"
                    >
                      <span className="mt-0.5">{toolEmoji(ev.tool)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[11px]">
                          <span className="text-brand">{ev.tool}</span>
                          <span className="text-muted-foreground">(</span>
                          <span className="text-muted-foreground">
                            {summariseInput(ev.tool, ev.input)}
                          </span>
                          <span className="text-muted-foreground">)</span>
                          {ev.state === "running" && (
                            <span className="ml-1 animate-pulse-soft text-muted-foreground">
                              …
                            </span>
                          )}
                        </div>
                        {ev.summary && (
                          <div className="text-[11px] text-muted-foreground">
                            ↳ {ev.summary}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {streaming && events.every((e) => e.state === "done") && (
                    <li className="text-[11px] text-muted-foreground italic">
                      thinking about next step…
                    </li>
                  )}
                </ul>
              )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StageDot({ state }: { state: StageState["state"] }) {
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
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
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

function toolEmoji(tool: ToolEvent["tool"]): string {
  if (tool === "webSearch") return "🔍";
  if (tool === "fetchUrl") return "URL";
  return "🏛️";
}

function summariseInput(tool: ToolEvent["tool"], input: unknown): string {
  if (typeof input !== "object" || !input) return "";
  const i = input as Record<string, unknown>;
  if (tool === "webSearch") return `"${truncate(String(i.query ?? ""), 50)}"`;
  if (tool === "fetchUrl") return hostnameSafe(i.url);
  if (tool === "companyLookup") return `"${i.name ?? ""}", ${i.country ?? ""}`;
  return "";
}

function hostnameSafe(url: unknown): string {
  if (typeof url !== "string") return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function Spark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-brand">
      <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
    </svg>
  );
}
