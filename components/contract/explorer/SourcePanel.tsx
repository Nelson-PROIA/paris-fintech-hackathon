"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";

type Source = {
  name: string;
  language: string;
  body: string;
  description: string;
};

/**
 * Solidity source viewer with file switcher. Source bodies are read on the
 * server and serialised into props so this stays a fully client-side
 * collapsible — no extra network roundtrip when the user expands it.
 */
export function SourcePanel({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(sources[0]?.name ?? "");

  const current = sources.find((s) => s.name === active) ?? sources[0];
  if (!current) return null;

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Source
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifiable Solidity source — same files Hardhat compiled to deploy
            this contract.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold transition hover:border-foreground/30"
        >
          {open ? "Hide source" : "Show source"}
        </button>
      </header>

      {open && (
        <>
          <nav className="flex flex-wrap items-center gap-1.5 border-b border-border px-6 py-3">
            {sources.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setActive(s.name)}
                className={
                  s.name === active
                    ? "rounded-md border border-foreground/30 bg-background px-2.5 py-1 font-mono text-[11px] font-semibold"
                    : "rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition hover:bg-accent"
                }
              >
                {s.name}
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-muted-foreground">
              {current.description} · {current.body.split("\n").length} lines
              <CopyButton value={current.body} label="Copy file" />
            </span>
          </nav>

          <div className="overflow-x-auto bg-background/60 p-4">
            <pre className="font-mono text-[11px] leading-relaxed">
              <code>{current.body}</code>
            </pre>
          </div>
        </>
      )}
    </section>
  );
}
