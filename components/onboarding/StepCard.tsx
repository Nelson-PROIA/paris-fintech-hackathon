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
        "rounded-xl border transition",
        state === "active"
          ? "border-foreground/20 bg-card shadow-sm"
          : "border-border bg-background",
        state === "pending" && "opacity-60"
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Step {index + 1} / {total}
          </div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {state === "done" && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent"
          >
            Modifier
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
