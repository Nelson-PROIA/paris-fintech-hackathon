"use client";

import { useState, type ReactNode } from "react";

export type FilterMode = "manual" | "natural";

export function FilterModeTabs({
  manual,
  natural,
  initialMode = "natural",
  onModeChange,
}: {
  manual: ReactNode;
  natural: ReactNode;
  initialMode?: FilterMode;
  onModeChange?: (m: FilterMode) => void;
}) {
  const [mode, setMode] = useState<FilterMode>(initialMode);

  function set(m: FilterMode) {
    setMode(m);
    onModeChange?.(m);
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex rounded-md border border-border p-0.5">
        <Tab active={mode === "natural"} onClick={() => set("natural")}>
          Describe in plain English
        </Tab>
        <Tab active={mode === "manual"} onClick={() => set("manual")}>
          Manual filters
        </Tab>
      </div>
      <div role="tabpanel">{mode === "manual" ? manual : natural}</div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          : "rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}
