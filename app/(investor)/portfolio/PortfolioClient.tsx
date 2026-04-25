"use client";

import { useState } from "react";
import { PortfolioView } from "@/components/PortfolioView";
import { FilterChips } from "@/components/FilterChips";
import { FilterModeTabs } from "@/components/FilterModeTabs";
import { NaturalLanguageInput } from "@/components/NaturalLanguageInput";
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

  const [status, setStatus] = useState<"idle" | "parsing" | "loading" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

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

  async function handleManualSubmit() {
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

  const submitting = status === "loading" || status === "parsing";

  const manualPanel = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleManualSubmit();
      }}
      className="space-y-4 rounded-lg border border-border p-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Total capital (€)">
          <input
            type="number"
            value={totalCapital}
            onChange={(e) => setTotalCapital(Number(e.target.value))}
            min={10_000}
            step={10_000}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Stage preference">
          <select
            value={stagePreference}
            onChange={(e) =>
              setStagePreference(e.target.value as StagePref)
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
            onChange={(e) => setRiskTolerance(e.target.value as RiskTol)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
        />
      </Field>

      <Field label={`Countries (${countries.length || "any"})`}>
        <FilterChips
          options={allCountries}
          selected={countries}
          onChange={setCountries}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Max positions">
          <input
            type="number"
            value={maxPositions}
            onChange={(e) => setMaxPositions(Number(e.target.value))}
            min={3}
            max={25}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label="Thesis (optional)">
        <textarea
          value={thesisText}
          onChange={(e) => setThesisText(e.target.value)}
          placeholder="e.g. Cash-flow-positive European SMBs in B2B services and SaaS, sub-€500k tickets, 3-year hold."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex items-center justify-end gap-3">
        {elapsed != null && status === "idle" && (
          <span className="text-xs text-muted-foreground">
            built in {(elapsed / 1000).toFixed(1)}s
          </span>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Building…" : "Build portfolio"}
        </button>
      </div>
    </form>
  );

  const naturalPanel = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleNaturalSubmit();
      }}
      className="space-y-4 rounded-lg border border-border p-4"
    >
      <Field label="Describe what you want, or click the mic to talk">
        <NaturalLanguageInput
          value={naturalText}
          onChange={setNaturalText}
          placeholder="e.g. €2 million across French B2B SaaS and agencies. Low risk, profitable companies, max 12 positions, 3-year hold."
          rows={5}
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          The AI translates this into the filters and runs the portfolio.
        </p>
        <div className="flex items-center gap-3">
          {status === "parsing" && (
            <span className="text-xs text-muted-foreground">
              parsing…
            </span>
          )}
          {elapsed != null && status === "idle" && (
            <span className="text-xs text-muted-foreground">
              built in {(elapsed / 1000).toFixed(1)}s
            </span>
          )}
          <button
            type="submit"
            disabled={submitting || !naturalText.trim()}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {status === "parsing"
              ? "Parsing…"
              : status === "loading"
                ? "Building…"
                : "Build portfolio"}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="space-y-8">
      <FilterModeTabs manual={manualPanel} natural={naturalPanel} />

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
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
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function summariseParsed(p: PortfolioFilterParse): string {
  const bits: string[] = [];
  if (p.totalCapital != null)
    bits.push(`€${(p.totalCapital).toLocaleString("en-GB")}`);
  if (p.sectors?.length) bits.push(`sectors: ${p.sectors.join(", ")}`);
  if (p.countries?.length) bits.push(`countries: ${p.countries.join(", ")}`);
  if (p.stagePreference && p.stagePreference !== "any")
    bits.push(`stage: ${p.stagePreference}`);
  if (p.riskTolerance) bits.push(`risk: ${p.riskTolerance}`);
  if (p.maxPositions != null) bits.push(`max ${p.maxPositions} positions`);
  return bits.length ? bits.join(" • ") : "(no fields detected)";
}
