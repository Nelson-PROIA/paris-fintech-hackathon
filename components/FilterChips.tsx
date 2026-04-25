"use client";

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
            className={
              active
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition"
                : "rounded-full border border-border px-3 py-1 text-xs transition hover:bg-accent"
            }
            aria-pressed={active}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
