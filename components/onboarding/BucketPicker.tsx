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
              "rounded-md border px-3 py-2.5 text-left text-sm transition",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:bg-accent",
              disabled && "opacity-50"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
