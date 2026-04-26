"use client";

import { cn } from "@/lib/utils";

/**
 * Toggle pill chips. `renderLabel` lets callers humanise enum values
 * without losing the underlying value (e.g. saas_micro → "SaaS").
 */
export function FilterChips({
  options,
  selected,
  onChange,
  renderLabel = (s) => s,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  renderLabel?: (opt: string) => string;
}) {
  function toggle(opt: string) {
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt]
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
            aria-pressed={active}
          >
            {active && (
              <svg
                width="10"
                height="10"
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
            )}
            {renderLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}
