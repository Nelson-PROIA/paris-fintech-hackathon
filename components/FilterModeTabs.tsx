"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
      <div
        role="tablist"
        className="relative inline-flex items-center rounded-full border border-border bg-card/60 p-1 shadow-soft backdrop-blur"
      >
        {/* Sliding pill background */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1 bottom-1 rounded-full gradient-brand shadow-soft transition-all duration-300 ease-out",
            mode === "natural" ? "left-1 right-[50%]" : "left-[50%] right-1"
          )}
        />
        <Tab active={mode === "natural"} onClick={() => set("natural")}>
          <SparkIcon />
          Plain English
        </Tab>
        <Tab active={mode === "manual"} onClick={() => set("manual")}>
          <SlidersIcon />
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
      className={cn(
        "relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold tracking-tight transition-colors",
        active
          ? "text-brand-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function SparkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </svg>
  );
}
