"use client";

import { cn } from "@/lib/utils";

export type StepState = "pending" | "active" | "done";

type Props = {
  index: number;
  total: number;
  title: string;
  subtitle?: string;
  state: StepState;
  onEdit?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function StepCard({
  index,
  total,
  title,
  subtitle,
  state,
  onEdit,
  children,
  footer,
}: Props) {
  return (
    <section
      data-state={state}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-300",
        state === "active"
          ? "surface-paper border-brand/30 shadow-lift"
          : state === "done"
            ? "surface bg-card/70"
            : "border-border bg-card/40 opacity-70"
      )}
    >
      {state === "active" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent"
        />
      )}
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <StepBadge index={index} total={total} state={state} />
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Step {index + 1} of {total}
            </div>
            <h2 className="font-serif text-lg font-semibold leading-tight tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {state === "done" && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-border bg-card/60 px-3 py-1 text-xs font-medium transition hover:border-brand/30 hover:bg-accent"
          >
            Edit
          </button>
        )}
      </header>
      <div className="space-y-5 px-5 py-5">{children}</div>
      {footer && (
        <footer className="border-t border-border px-5 py-3">{footer}</footer>
      )}
    </section>
  );
}

function StepBadge({
  index,
  total: _total,
  state,
}: {
  index: number;
  total: number;
  state: StepState;
}) {
  if (state === "done") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
        <svg
          width="14"
          height="14"
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
  }
  if (state === "active") {
    return (
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-brand to-chart-4 opacity-90" />
        <span className="absolute inset-[2px] rounded-full bg-card" />
        <span className="relative font-serif text-sm font-semibold tabular-nums tracking-tight gradient-headline">
          {String(index + 1).padStart(2, "0")}
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-xs font-semibold tabular-nums text-muted-foreground">
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}
