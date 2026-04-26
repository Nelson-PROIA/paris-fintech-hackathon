"use client";

import { useState } from "react";
import type { LLMEnrichKind, ProfileData } from "@/lib/onboarding/types";

type EnrichResponse = {
  enriched: string;
  rationale: string | null;
  extracted: {
    sectors: string[] | null;
    countries: string[] | null;
    keywords: string[] | null;
    summary: string | null;
  } | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  enrichKind: LLMEnrichKind;
  context?: ProfileData;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  /** Optional: receive the LLM extracted side-data (e.g. to apply filters elsewhere) */
  onExtract?: (extracted: EnrichResponse["extracted"]) => void;
};

export function MessageInputWithAI({
  value,
  onChange,
  enrichKind,
  context,
  placeholder,
  rows = 4,
  disabled,
  onExtract,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [proposal, setProposal] = useState<EnrichResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enrich() {
    if (!value.trim() || disabled) return;
    setStatus("loading");
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/onboarding/llm-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: enrichKind, raw: value, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProposal(data as EnrichResponse);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  function accept() {
    if (!proposal) return;
    onChange(proposal.enriched);
    if (onExtract) onExtract(proposal.extracted);
    setProposal(null);
  }

  function reject() {
    setProposal(null);
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled || status === "loading"}
        className="w-full resize-y rounded-lg border border-border bg-card/80 px-3 py-2.5 text-sm leading-relaxed shadow-soft transition placeholder:text-muted-foreground/70 focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/30 disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          <span className="tabular-nums">{value.length}</span> characters · plain
          text is fine
        </p>
        <button
          type="button"
          onClick={enrich}
          disabled={!value.trim() || disabled || status === "loading"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium transition hover:border-brand/30 hover:bg-accent disabled:opacity-50"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            className="text-brand"
          >
            <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
          </svg>
          {status === "loading" ? "Enriching…" : "Enrich with AI"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {proposal && (
        <div className="surface-paper relative space-y-3 overflow-hidden p-3.5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent"
          />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand">
              AI proposal
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
              {proposal.enriched}
            </p>
          </div>
          {proposal.extracted &&
            (proposal.extracted.sectors?.length ||
              proposal.extracted.countries?.length ||
              proposal.extracted.keywords?.length) && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {proposal.extracted.sectors?.length ? (
                  <div>Sectors detected: {proposal.extracted.sectors.join(", ")}</div>
                ) : null}
                {proposal.extracted.countries?.length ? (
                  <div>Countries detected: {proposal.extracted.countries.join(", ")}</div>
                ) : null}
                {proposal.extracted.keywords?.length ? (
                  <div>Keywords: {proposal.extracted.keywords.join(", ")}</div>
                ) : null}
              </div>
            )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={accept}
              className="gradient-brand inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-soft ring-1 ring-inset ring-white/20 transition hover:brightness-105"
            >
              Accept and replace
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(value + "\n\n" + proposal.enriched);
                setProposal(null);
              }}
              className="rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium transition hover:border-brand/30 hover:bg-accent"
            >
              Append to text
            </button>
            <button
              type="button"
              onClick={reject}
              className="rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium transition hover:border-border hover:bg-accent"
            >
              Keep original
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
