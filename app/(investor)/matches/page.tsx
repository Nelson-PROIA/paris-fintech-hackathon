import { requireRole } from "@/lib/auth";
import {
  getDb,
  getOrCreateInvestor,
  listCountries,
  listSectors,
} from "@/lib/db";
import type { MatchedItemHydrated } from "@/lib/ai/match";
import { MatchesClient } from "./MatchesClient";
import { ThesisClient } from "../thesis/ThesisClient";

type MatchCacheRow = {
  investor_id: string;
  result_json: string;
  generated_at: number;
};

export default async function MatchesPage() {
  const user = await requireRole("investor");
  const investor = getOrCreateInvestor(user.id, user.display_name ?? user.email);
  const allSectors = listSectors();
  const allCountries = listCountries();

  const hasThesis =
    !!investor?.thesis_text ||
    !!investor?.sectors_json ||
    !!investor?.countries_json;

  const initialThesis = {
    thesisText: investor?.thesis_text ?? "",
    sectors: investor?.sectors_json
      ? (JSON.parse(investor.sectors_json) as string[])
      : [],
    countries: investor?.countries_json
      ? (JSON.parse(investor.countries_json) as string[])
      : [],
    stages: investor?.stages_json
      ? (JSON.parse(investor.stages_json) as Array<
          "pre_revenue" | "early" | "growth"
        >)
      : [],
    ticketMinEur: investor?.ticket_min_eur ?? null,
    ticketMaxEur: investor?.ticket_max_eur ?? null,
    totalCapitalEur: investor?.total_capital_eur ?? null,
    riskTolerance: (investor?.risk_tolerance ?? "medium") as
      | "low"
      | "medium"
      | "high",
  };

  let cachedMatches: MatchedItemHydrated[] = [];
  let cachedAt: number | null = null;
  if (hasThesis) {
    const row = getDb()
      .prepare("SELECT * FROM match_caches WHERE investor_id = ?")
      .get(investor.id) as MatchCacheRow | undefined;
    if (row) {
      cachedMatches = JSON.parse(row.result_json) as MatchedItemHydrated[];
      cachedAt = row.generated_at;
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-7">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Curated for your thesis
        </p>
        <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.025em]">
          Top deals, ranked by your thesis.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Type or speak your thesis. The AI filters live campaigns and ranks
          the best fits with one-line reasoning per pick.
        </p>
      </header>

      <section className="mb-6">
        <ThesisClient
          allSectors={allSectors}
          allCountries={allCountries}
          initial={initialThesis}
        />
      </section>

      {hasThesis ? (
        <MatchesClient
          cachedMatches={cachedMatches}
          cachedAt={cachedAt}
          activeThesis={{
            sectors: initialThesis.sectors,
            countries: initialThesis.countries,
            ticketMinEur: initialThesis.ticketMinEur,
            ticketMaxEur: initialThesis.ticketMaxEur,
            riskTolerance: initialThesis.riskTolerance,
          }}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Type a thesis above (or hit the mic) to get your first ranked picks.
          </p>
        </div>
      )}
    </main>
  );
}
