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
              "rounded-lg border px-3.5 py-3 text-left text-sm font-medium transition",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-accent",
              disabled && "opacity-50"
            )}
          >
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
