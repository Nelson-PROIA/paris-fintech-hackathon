"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FilterChips } from "@/components/FilterChips";
import { NaturalLanguageInput } from "@/components/NaturalLanguageInput";
import { humanize } from "@/lib/format";
import type { PortfolioFilterParse } from "@/lib/ai/parse-query";

type Stage = "pre_revenue" | "early" | "growth";
type Risk = "low" | "medium" | "high";
const STAGES: Stage[] = ["pre_revenue", "early", "growth"];

type InitialThesis = {
  thesisText: string;
  sectors: string[];
  countries: string[];
  stages: Stage[];
  ticketMinEur: number | null;
  ticketMaxEur: number | null;
  totalCapitalEur: number | null;
  riskTolerance: Risk;
};

export function ThesisClient({
  allSectors,
  allCountries,
  initial,
}: {
  allSectors: string[];
  allCountries: string[];
  initial: InitialThesis;
}) {
  const router = useRouter();

  const [thesisText, setThesisText] = useState(initial.thesisText);
  const [sectors, setSectors] = useState<string[]>(initial.sectors);
  const [countries, setCountries] = useState<string[]>(initial.countries);
  const [stages, setStages] = useState<Stage[]>(initial.stages);
  const [ticketMin, setTicketMin] = useState(
    initial.ticketMinEur?.toString() ?? ""
  );
  const [ticketMax, setTicketMax] = useState(
    initial.ticketMaxEur?.toString() ?? ""
  );
  const [totalCapital, setTotalCapital] = useState(
    initial.totalCapitalEur?.toString() ?? ""
  );
  const [risk, setRisk] = useState<Risk>(initial.riskTolerance);

  const [naturalText, setNaturalText] = useState("");
  const [parsedSummary, setParsedSummary] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Allow other panes (e.g. the empty-state CTA on /matches) to pop the filters
  // drawer open without coupling them to this component's internals.
  useEffect(() => {
    function onOpenFilters() {
      setFiltersOpen(true);
    }
    window.addEventListener("loanly:open-filters", onOpenFilters);
    return () =>
      window.removeEventListener("loanly:open-filters", onOpenFilters);
  }, []);

  const [status, setStatus] = useState<
    "idle" | "parsing" | "saving" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const filterCount =
    sectors.length +
    countries.length +
    stages.length +
    (ticketMin ? 1 : 0) +
    (ticketMax ? 1 : 0) +
    (totalCapital ? 1 : 0) +
    (risk !== "medium" ? 1 : 0) +
    (thesisText ? 1 : 0);

  async function save(values: {
    thesisText: string;
    sectors: string[];
    countries: string[];
    stages: Stage[];
    ticketMin: string;
    ticketMax: string;
    totalCapital: string;
    risk: Risk;
  }) {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/investor/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thesisText: values.thesisText || null,
          sectors: values.sectors,
          countries: values.countries,
          stages: values.stages,
          ticketMinEur: values.ticketMin ? Number(values.ticketMin) : null,
          ticketMaxEur: values.ticketMax ? Number(values.ticketMax) : null,
          totalCapitalEur: values.totalCapital
            ? Number(values.totalCapital)
            : null,
          riskTolerance: values.risk,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSavedAt(Date.now());
      setStatus("idle");
      router.refresh();
      // Tell any listeners (e.g. MatchesClient on /matches) the thesis changed
      // so they can re-rank without forcing the user to hit a separate button.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("loanly:thesis-saved"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function handleManualSave() {
    setFiltersOpen(false);
    await save({
      thesisText,
      sectors,
      countries,
      stages,
      ticketMin,
      ticketMax,
      totalCapital,
      risk,
    });
  }

  async function handleNaturalSave() {
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
            `HTTP ${res.status}`
        );

      const nextSectors = (parsed.sectors ?? sectors).filter((s) =>
        allSectors.includes(s)
      );
      const nextCountries = (parsed.countries ?? countries).filter((c) =>
        allCountries.includes(c)
      );
      const nextRisk = parsed.riskTolerance ?? risk;
      const nextThesisText = parsed.thesisText ?? thesisText;
      const nextTotalCapital =
        parsed.totalCapital != null
          ? parsed.totalCapital.toString()
          : totalCapital;
      const nextStages: Stage[] =
        parsed.stagePreference && parsed.stagePreference !== "any"
          ? [parsed.stagePreference as Stage]
          : stages;

      setSectors(nextSectors);
      setCountries(nextCountries);
      setRisk(nextRisk);
      setThesisText(nextThesisText);
      setTotalCapital(nextTotalCapital);
      setStages(nextStages);
      setParsedSummary(summariseParsed(parsed));

      await save({
        thesisText: nextThesisText,
        sectors: nextSectors,
        countries: nextCountries,
        stages: nextStages,
        ticketMin,
        ticketMax,
        totalCapital: nextTotalCapital,
        risk: nextRisk,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <NaturalLanguageInput
        value={naturalText}
        onChange={setNaturalText}
        onSubmit={handleNaturalSave}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        filtersOpen={filtersOpen}
        filterCount={filterCount}
        placeholder="Describe your thesis — e.g. profitable French B2B SaaS, €100k–500k tickets, low risk"
        status={status === "saving" ? "loading" : status === "parsing" ? "parsing" : "idle"}
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

            <Field label={`Stages (${stages.length || "any"})`}>
              <FilterChips
                options={STAGES}
                selected={stages}
                onChange={(next) => setStages(next as Stage[])}
                renderLabel={humanize}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Ticket min (€)">
                <input
                  type="number"
                  value={ticketMin}
                  onChange={(e) => setTicketMin(e.target.value)}
                  min={0}
                  step={10000}
                  placeholder="any"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition focus:border-foreground/30 focus:outline-none"
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
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition focus:border-foreground/30 focus:outline-none"
                />
              </Field>
              <Field label="Total capital (€)">
                <input
                  type="number"
                  value={totalCapital}
                  onChange={(e) => setTotalCapital(e.target.value)}
                  min={0}
                  step={50000}
                  placeholder="optional"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition focus:border-foreground/30 focus:outline-none"
                />
              </Field>
              <Field label="Risk tolerance">
                <select
                  value={risk}
                  onChange={(e) => setRisk(e.target.value as Risk)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition focus:border-foreground/30 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>
            </div>

            <Field label="Free-form thesis">
              <textarea
                value={thesisText}
                onChange={(e) => setThesisText(e.target.value)}
                rows={3}
                placeholder="e.g. Cash-flow-positive European B2B SMBs, sub-€500k tickets, 3-year hold."
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
                onClick={handleManualSave}
                disabled={status === "saving"}
                className="rounded-md bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {status === "saving" ? "Saving…" : "Save thesis"}
              </button>
            </div>
          </div>
        </div>
      )}

      {savedAt && status === "idle" && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Saved {new Date(savedAt).toLocaleTimeString()}
        </p>
      )}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
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
  return bits.length ? bits.join(" • ") : "(no fields detected)";
}
