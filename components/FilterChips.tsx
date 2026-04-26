"use client";

import { cn } from "@/lib/utils";

export function FilterChips({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
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
              "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200",
              active
                ? "border-brand/40 bg-brand-muted text-brand-foreground shadow-soft ring-1 ring-inset ring-white/30 dark:bg-brand-muted/60 dark:text-foreground"
                : "border-border bg-card/60 text-muted-foreground hover:border-brand/30 hover:bg-accent hover:text-foreground"
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
                className="text-brand"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
