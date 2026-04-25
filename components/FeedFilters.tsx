"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterChips } from "@/components/FilterChips";
import { FilterModeTabs } from "@/components/FilterModeTabs";
import { NaturalLanguageInput } from "@/components/NaturalLanguageInput";
import type { FeedFilterParse } from "@/lib/ai/parse-query";

export function FeedFilters({
  allSectors,
  allCountries,
}: {
  allSectors: string[];
  allCountries: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSectors = searchParams.getAll("sector");
  const initialCountries = searchParams.getAll("country");
  const initialMin = searchParams.get("ticketMin") ?? "";
  const initialMax = searchParams.get("ticketMax") ?? "";

  const [sectors, setSectors] = useState<string[]>(initialSectors);
  const [countries, setCountries] = useState<string[]>(initialCountries);
  const [ticketMin, setTicketMin] = useState(initialMin);
  const [ticketMax, setTicketMax] = useState(initialMax);

  const [naturalText, setNaturalText] = useState("");
  const [parsedSummary, setParsedSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing">("idle");
  const [error, setError] = useState<string | null>(null);

  function pushFilters(opts: {
    sectors: string[];
    countries: string[];
    ticketMin: string;
    ticketMax: string;
  }) {
    const params = new URLSearchParams();
    for (const s of opts.sectors) params.append("sector", s);
    for (const c of opts.countries) params.append("country", c);
    if (opts.ticketMin) params.set("ticketMin", opts.ticketMin);
    if (opts.ticketMax) params.set("ticketMax", opts.ticketMax);
    const qs = params.toString();
    router.push(qs ? `/feed?${qs}` : "/feed");
  }

  function applyManual() {
    pushFilters({ sectors, countries, ticketMin, ticketMax });
  }

  function reset() {
    setSectors([]);
    setCountries([]);
    setTicketMin("");
    setTicketMax("");
    setNaturalText("");
    router.push("/feed");
  }

  async function applyNatural() {
    if (!naturalText.trim()) return;
    setStatus("parsing");
    setError(null);
    setParsedSummary(null);
    try {
      const res = await fetch("/api/parse-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "feed",
          text: naturalText,
          allowedSectors: allSectors,
          allowedCountries: allCountries,
        }),
      });
      const parsed: FeedFilterParse = await res.json();
      if (!res.ok)
        throw new Error(
          (parsed as unknown as { error?: string }).error ??
            `HTTP ${res.status}`
        );
      const nextSectors = (parsed.sectors ?? []).filter((s) =>
        allSectors.includes(s)
      );
      const nextCountries = (parsed.countries ?? []).filter((c) =>
        allCountries.includes(c)
      );
      setSectors(nextSectors);
      setCountries(nextCountries);
      setTicketMin(parsed.ticketMin?.toString() ?? "");
      setTicketMax(parsed.ticketMax?.toString() ?? "");
      setParsedSummary(summariseFeedParsed(parsed));
      pushFilters({
        sectors: nextSectors,
        countries: nextCountries,
        ticketMin: parsed.ticketMin?.toString() ?? "",
        ticketMax: parsed.ticketMax?.toString() ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus("idle");
    }
  }

  const manualPanel = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyManual();
      }}
      className="space-y-4 rounded-lg border border-border p-4"
    >
      <Field label={`Sectors (${sectors.length || "any"})`}>
        <FilterChips
          options={allSectors}
          selected={sectors}
          onChange={setSectors}
        />
      </Field>

      <Field label={`Countries (${countries.length || "any"})`}>
        <FilterChips
          options={allCountries}
          selected={countries}
          onChange={setCountries}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ticket min (€)">
          <input
            type="number"
            value={ticketMin}
            onChange={(e) => setTicketMin(e.target.value)}
            min={0}
            step={10000}
            placeholder="any"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Ticket max (€)">
          <input
            type="number"
            value={ticketMax}
            onChange={(e) => setTicketMax(e.target.value)}
            min={0}
            step={10000}
            placeholder="any"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Reset
        </button>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Apply
        </button>
      </div>
    </form>
  );

  const naturalPanel = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void applyNatural();
      }}
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <Field label="Describe what you want, or click the mic to talk">
        <NaturalLanguageInput
          value={naturalText}
          onChange={setNaturalText}
          placeholder="e.g. French SaaS and agencies, tickets up to €300k. Or: artisan makers in Italy seeking under €200k."
          rows={4}
        />
      </Field>
      {parsedSummary && (
        <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
          <span className="font-medium text-muted-foreground">
            AI applied:{" "}
          </span>
          <span>{parsedSummary}</span>
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        {status === "parsing" && (
          <span className="text-xs text-muted-foreground">parsing…</span>
        )}
        <button
          type="submit"
          disabled={status === "parsing" || !naturalText.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === "parsing" ? "Parsing…" : "Apply"}
        </button>
      </div>
    </form>
  );

  return (
    <div>
      <FilterModeTabs manual={manualPanel} natural={naturalPanel} />
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function summariseFeedParsed(p: FeedFilterParse): string {
  const bits: string[] = [];
  if (p.sectors?.length) bits.push(`sectors: ${p.sectors.join(", ")}`);
  if (p.countries?.length) bits.push(`countries: ${p.countries.join(", ")}`);
  if (p.ticketMin != null)
    bits.push(`min €${p.ticketMin.toLocaleString("en-GB")}`);
  if (p.ticketMax != null)
    bits.push(`max €${p.ticketMax.toLocaleString("en-GB")}`);
  return bits.length ? bits.join(" • ") : "(no fields detected)";
}
