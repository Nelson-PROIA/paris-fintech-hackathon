"use client";

import { useState } from "react";
import { PortfolioView } from "@/components/PortfolioView";
import { FilterChips } from "@/components/FilterChips";
import { NaturalLanguageInput } from "@/components/NaturalLanguageInput";
import { humanize } from "@/lib/format";
import type { PortfolioResult } from "@/lib/ai/portfolio-constructor";
import type { PortfolioFilterParse } from "@/lib/ai/parse-query";

type StagePref = "any" | "pre_revenue" | "early" | "growth";
type RiskTol = "low" | "medium" | "high";

export function PortfolioClient({
  allSectors,
  allCountries,
}: {
  allSectors: string[];
  allCountries: string[];
}) {
  const [totalCapital, setTotalCapital] = useState(2_000_000);
  const [sectors, setSectors] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [stagePreference, setStagePreference] = useState<StagePref>("any");
  const [riskTolerance, setRiskTolerance] = useState<RiskTol>("medium");
  const [maxPositions, setMaxPositions] = useState(12);
  const [thesisText, setThesisText] = useState("");

  const [naturalText, setNaturalText] = useState("");
  const [parsedSummary, setParsedSummary] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "parsing" | "loading" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const filterCount =
    sectors.length +
    countries.length +
    (stagePreference !== "any" ? 1 : 0) +
    (riskTolerance !== "medium" ? 1 : 0) +
    (thesisText ? 1 : 0);

  function applyParsed(p: PortfolioFilterParse) {
    if (p.totalCapital != null) setTotalCapital(p.totalCapital);
    if (p.sectors != null)
      setSectors(p.sectors.filter((s) => allSectors.includes(s)));
    if (p.countries != null)
      setCountries(p.countries.filter((c) => allCountries.includes(c)));
    if (p.stagePreference != null) setStagePreference(p.stagePreference);
    if (p.riskTolerance != null) setRiskTolerance(p.riskTolerance);
    if (p.maxPositions != null) setMaxPositions(p.maxPositions);
    if (p.thesisText != null) setThesisText(p.thesisText);
  }

  async function buildFromValues(values: {
    totalCapital: number;
    sectors: string[];
    countries: string[];
    stagePreference: StagePref;
    riskTolerance: RiskTol;
    maxPositions: number;
    thesisText: string;
  }) {
    setStatus("loading");
    setError(null);
    setElapsed(null);
    const t0 = Date.now();
    try {
      const res = await fetch("/api/investor/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalCapital: values.totalCapital,
          sectors: values.sectors.length ? values.sectors : undefined,
          countries: values.countries.length ? values.countries : undefined,
          stagePreference: values.stagePreference,
          riskTolerance: values.riskTolerance,
          maxPositions: values.maxPositions,
          thesisText: values.thesisText || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data.result);
      setElapsed(Date.now() - t0);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function handleManualBuild() {
    setFiltersOpen(false);
    await buildFromValues({
      totalCapital,
      sectors,
      countries,
      stagePreference,
      riskTolerance,
      maxPositions,
      thesisText,
    });
  }

  async function handleNaturalSubmit() {
    if (!naturalText.trim()) return;
    setStatus("parsing");
    setError(null);
    setParsedSummary(null);
    try {
      const res = await fetch("/api/parse-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "portfolio",
          text: naturalText,
          allowedSectors: allSectors,
          allowedCountries: allCountries,
        }),
      });
      const parsed: PortfolioFilterParse = await res.json();
      if (!res.ok)
        throw new Error(
          (parsed as unknown as { error?: string }).error ??
            `parse HTTP ${res.status}`
        );
      applyParsed(parsed);
      setParsedSummary(summariseParsed(parsed));

      await buildFromValues({
        totalCapital: parsed.totalCapital ?? totalCapital,
        sectors: (parsed.sectors ?? sectors).filter((s) =>
          allSectors.includes(s)
        ),
        countries: (parsed.countries ?? countries).filter((c) =>
          allCountries.includes(c)
        ),
        stagePreference: parsed.stagePreference ?? stagePreference,
        riskTolerance: parsed.riskTolerance ?? riskTolerance,
        maxPositions: parsed.maxPositions ?? maxPositions,
        thesisText: parsed.thesisText ?? thesisText,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <NaturalLanguageInput
          value={naturalText}
          onChange={setNaturalText}
          onSubmit={handleNaturalSubmit}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          filtersOpen={filtersOpen}
          filterCount={filterCount}
          placeholder="Describe your portfolio — e.g. €2M across French B2B SaaS, low risk, 12 positions"
          status={status === "loading" ? "loading" : status === "parsing" ? "parsing" : "idle"}
        />

        {parsedSummary && (
          <div className="rounded-md border border-border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium uppercase tracking-[0.16em] text-brand">
              AI applied
            </span>
            <span className="mx-2 text-border">·</span>
            <span>{parsedSummary}</span>
          </div>
        )}

        {filtersOpen && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Total capital (€)">
                  <input
                    type="number"
                    value={totalCapital}
                    onChange={(e) => setTotalCapital(Number(e.target.value))}
                    min={10_000}
                    step={10_000}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition focus:border-foreground/30 focus:outline-none"
                  />
                </Field>
                <Field label="Stage preference">
                  <select
                    value={stagePreference}
                    onChange={(e) =>
                      setStagePreference(e.target.value as StagePref)
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition focus:border-foreground/30 focus:outline-none"
                  >
                    <option value="any">Any</option>
                    <option value="pre_revenue">Pre-revenue</option>
                    <option value="early">Early</option>
                    <option value="growth">Growth</option>
                  </select>
                </Field>
                <Field label="Risk tolerance">
                  <select
                    value={riskTolerance}
                    onChange={(e) =>
                      setRiskTolerance(e.target.value as RiskTol)
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition focus:border-foreground/30 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
              </div>

              <Field label={`Sectors (${sectors.length || "any"})`}>
                <FilterChips
                  options={allSectors}
                  selected={sectors}
                  onChange={setSectors}
                  renderLabel={humanize}
                />
              </Field>

              <Field label={`Countries (${countries.length || "any"})`}>
                <FilterChips
                  options={allCountries}
                  selected={countries}
                  onChange={setCountries}
                />
              </Field>

              <Field label="Max positions">
                <input
                  type="number"
                  value={maxPositions}
                  onChange={(e) => setMaxPositions(Number(e.target.value))}
                  min={3}
                  max={25}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition focus:border-foreground/30 focus:outline-none"
                />
              </Field>

              <Field label="Thesis (optional)">
                <textarea
                  value={thesisText}
                  onChange={(e) => setThesisText(e.target.value)}
                  rows={3}
                  placeholder="e.g. Cash-flow-positive European SMBs, sub-€500k tickets, 3-year hold."
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed transition focus:border-foreground/30 focus:outline-none"
                />
              </Field>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleManualBuild}
                  disabled={status === "loading"}
                  className="rounded-md bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {status === "loading" ? "Building…" : "Build portfolio"}
                </button>
              </div>
            </div>
          </div>
        )}

        {elapsed != null && status === "idle" && (
          <p className="text-xs text-muted-foreground">
            Built in {(elapsed / 1000).toFixed(1)}s
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && <PortfolioView result={result} />}
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
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function summariseParsed(p: PortfolioFilterParse): string {
  const bits: string[] = [];
  if (p.totalCapital != null)
    bits.push(`€${p.totalCapital.toLocaleString("en-GB")}`);
  if (p.sectors?.length)
    bits.push(`sectors: ${p.sectors.map(humanize).join(", ")}`);
  if (p.countries?.length) bits.push(`countries: ${p.countries.join(", ")}`);
  if (p.stagePreference && p.stagePreference !== "any")
    bits.push(`stage: ${humanize(p.stagePreference)}`);
  if (p.riskTolerance) bits.push(`risk: ${p.riskTolerance}`);
  if (p.maxPositions != null) bits.push(`max ${p.maxPositions} positions`);
  return bits.length ? bits.join(" • ") : "(no fields detected)";
}
