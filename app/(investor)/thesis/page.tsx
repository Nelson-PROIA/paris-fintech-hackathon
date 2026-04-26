import { requireRole } from "@/lib/auth";
import {
  getInvestorByUserId,
  listCountries,
  listSectors,
} from "@/lib/db";
import { ThesisClient } from "./ThesisClient";
import { Badge } from "@/components/ui/badge";

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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <Badge variant="brand" className="mb-3 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Your investing rules
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Your{" "}
          <span className="serif-italic gradient-headline">thesis</span>.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Set what you&apos;re looking for. The AI uses this to rank deals on
          /matches and refresh your top picks hourly.
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
