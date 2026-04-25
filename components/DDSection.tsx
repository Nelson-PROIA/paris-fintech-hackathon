"use client";

import { useState } from "react";
import { DDBriefView } from "@/components/DDBrief";
import type { DDBrief } from "@/lib/ai/dd-analyst";

type LoadedBrief = { brief: DDBrief; generatedAt: number; cached: boolean };

export function DDSection({
  companyId,
  initialBrief,
}: {
  companyId: string;
  initialBrief: LoadedBrief | null;
}) {
  const [data, setData] = useState<LoadedBrief | null>(initialBrief);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    setStatus("loading");
    setError(null);
    const startedAt = Date.now();
    try {
      const res = await fetch(
        `/api/company/${companyId}/dd${force ? "?force=1" : ""}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData({
        brief: json.brief,
        generatedAt: json.generatedAt,
        cached: json.cached,
      });
      // Surface generation time for the demo wow factor
      if (!json.cached) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.info(`[DD] generated fresh in ${elapsed}s`);
      }
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-dashed border-border p-6 text-center">
        <h3 className="text-base font-semibold">AI due-diligence brief</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          One-page brief with traction, team, market, risk flags, and sources.
          Typically &lt;15s.
        </p>
        <button
          type="button"
          onClick={() => load(false)}
          disabled={status === "loading"}
          className="mt-4 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" ? "Generating…" : "Generate DD brief"}
        </button>
        {error && (
          <p className="mt-3 text-sm text-destructive">Error: {error}</p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <DDBriefView
        brief={data.brief}
        generatedAt={data.generatedAt}
        cached={data.cached}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => load(true)}
          disabled={status === "loading"}
          className="rounded-md border border-border px-4 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
        >
          {status === "loading" ? "Regenerating…" : "Regenerate"}
        </button>
        {error && (
          <p className="text-xs text-destructive">Error: {error}</p>
        )}
      </div>
    </div>
  );
}
