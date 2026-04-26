"use client";

import { cn } from "@/lib/utils";
import type { BucketOption } from "@/lib/onboarding/types";

type Props = {
  options: BucketOption[];
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  disabled?: boolean;
};

export function BucketPicker({ options, value, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.rangeKey}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected ? null : opt.value)}
            className={cn(
              "group relative overflow-hidden rounded-lg border px-3.5 py-3 text-left text-sm font-medium transition-all duration-200",
              selected
                ? "border-brand/40 bg-brand-muted text-brand-foreground shadow-soft ring-1 ring-inset ring-white/30 dark:bg-brand-muted/60 dark:text-foreground"
                : "border-border bg-card/60 text-foreground hover:-translate-y-0.5 hover:border-brand/30 hover:bg-accent hover:shadow-soft",
              disabled && "opacity-50"
            )}
          >
            {selected && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent"
              />
            )}
            <span className="flex items-center gap-1.5">
              {selected && (
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
                  className="text-brand"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
