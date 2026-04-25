import { requireRole } from "@/lib/auth";
import {
  getInvestorByUserId,
  listCountries,
  listSectors,
} from "@/lib/db";
import { ThesisClient } from "./ThesisClient";

export default async function ThesisPage() {
  const user = await requireRole("investor");
  const allSectors = listSectors();
  const allCountries = listCountries();
  const existing = getInvestorByUserId(user.id);

  const initial = existing
    ? {
        thesisText: existing.thesis_text ?? "",
        sectors: existing.sectors_json
          ? (JSON.parse(existing.sectors_json) as string[])
          : [],
        countries: existing.countries_json
          ? (JSON.parse(existing.countries_json) as string[])
          : [],
        stages: existing.stages_json
          ? (JSON.parse(existing.stages_json) as Array<
              "pre_revenue" | "early" | "growth"
            >)
          : [],
        ticketMinEur: existing.ticket_min_eur,
        ticketMaxEur: existing.ticket_max_eur,
        totalCapitalEur: existing.total_capital_eur,
        riskTolerance: (existing.risk_tolerance ?? "medium") as
          | "low"
          | "medium"
          | "high",
      }
    : {
        thesisText: "",
        sectors: [],
        countries: [],
        stages: [],
        ticketMinEur: null,
        ticketMaxEur: null,
        totalCapitalEur: null,
        riskTolerance: "medium" as const,
      };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Your thesis</h1>
        <p className="mt-1 text-muted-foreground">
          Set what you&apos;re looking for. The AI will use this to rank deals
          for you on /matches and refresh hourly.
        </p>
      </header>
      <ThesisClient
        allSectors={allSectors}
        allCountries={allCountries}
        initial={initial}
      />
    </main>
  );
}
