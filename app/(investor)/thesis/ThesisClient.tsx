"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilterChips } from "@/components/FilterChips";
import { FilterModeTabs } from "@/components/FilterModeTabs";
import { NaturalLanguageInput } from "@/components/NaturalLanguageInput";
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
  const [status, setStatus] = useState<
    "idle" | "parsing" | "saving" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function handleManualSave() {
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
          (parsed as unknown as { error?: string }).error ?? `HTTP ${res.status}`
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

  function toggleStage(s: Stage) {
    setStages((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  const submitting = status === "saving" || status === "parsing";

  const manualPanel = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleManualSave();
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

      <Field label={`Stages (${stages.length || "any"})`}>
        <FilterChips
          options={STAGES}
          selected={stages}
          onChange={(next) => setStages(next as Stage[])}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
        <Field label="Total capital (€)">
          <input
            type="number"
            value={totalCapital}
            onChange={(e) => setTotalCapital(e.target.value)}
            min={0}
            step={50000}
            placeholder="optional"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Risk tolerance">
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value as Risk)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
          placeholder="e.g. Cash-flow-positive European B2B SMBs, sub-€500k tickets, 3-year hold."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex items-center justify-end gap-3">
        {savedAt && status === "idle" && (
          <span className="text-xs text-muted-foreground">
            saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save thesis"}
        </button>
      </div>
    </form>
  );

  const naturalPanel = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleNaturalSave();
      }}
      className="space-y-4 rounded-lg border border-border p-4"
    >
      <Field label="Describe your investing thesis (or click the mic)">
        <NaturalLanguageInput
          value={naturalText}
          onChange={setNaturalText}
          placeholder="e.g. I want profitable European B2B SaaS and agencies in France and Benelux. Tickets €100k–500k, 3-year hold, low risk."
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

      <div className="flex items-center justify-end gap-3">
        {status === "parsing" && (
          <span className="text-xs text-muted-foreground">parsing…</span>
        )}
        {savedAt && status === "idle" && (
          <span className="text-xs text-muted-foreground">
            saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        <button
          type="submit"
          disabled={submitting || !naturalText.trim()}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === "parsing"
            ? "Parsing…"
            : status === "saving"
              ? "Saving…"
              : "Save thesis"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <FilterModeTabs manual={manualPanel} natural={naturalPanel} />
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
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
    bits.push(`€${p.totalCapital.toLocaleString("en-GB")}`);
  if (p.sectors?.length) bits.push(`sectors: ${p.sectors.join(", ")}`);
  if (p.countries?.length) bits.push(`countries: ${p.countries.join(", ")}`);
  if (p.stagePreference && p.stagePreference !== "any")
    bits.push(`stage: ${p.stagePreference}`);
  if (p.riskTolerance) bits.push(`risk: ${p.riskTolerance}`);
  return bits.length ? bits.join(" • ") : "(no fields detected)";
}
