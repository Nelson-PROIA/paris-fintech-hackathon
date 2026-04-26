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

/**
 * No more redundant step indicator. We render a single "Step N of M" eyebrow
 * label — no big numbered circle. State (active / done / pending) is
 * communicated via card border + a tiny status dot in the eyebrow.
 */
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
        "rounded-xl border bg-card transition-colors",
        state === "active"
          ? "border-foreground/20 shadow-sm"
          : state === "done"
            ? "border-border"
            : "border-border opacity-60"
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <StatusDot state={state} />
            Step {index + 1} of {total}
          </div>
          <h2 className="text-lg font-semibold leading-tight tracking-[-0.015em]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {state === "done" && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium transition hover:bg-accent"
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

function StatusDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="block h-1.5 w-1.5 rounded-full bg-emerald-500" />
    );
  }
  if (state === "active") {
    return (
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
      </span>
    );
  }
  return <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />;
}
