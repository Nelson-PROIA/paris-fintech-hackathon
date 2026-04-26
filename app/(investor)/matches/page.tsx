import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getDb, getOrCreateInvestor } from "@/lib/db";
import type { MatchedItemHydrated } from "@/lib/ai/match";
import { MatchesClient } from "./MatchesClient";

type MatchCacheRow = {
  investor_id: string;
  result_json: string;
  generated_at: number;
};

export default async function MatchesPage() {
  const user = await requireRole("investor");
  const investor = getOrCreateInvestor(user.id, user.display_name ?? user.email);
  const hasThesis =
    !!investor?.thesis_text ||
    !!investor?.sectors_json ||
    !!investor?.countries_json;

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
          Mistral Large reads your thesis, filters live campaigns, and ranks
          the best fits with one-line reasoning per pick.
        </p>
      </header>

      {!hasThesis ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-12 text-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Set thesis
          </span>
          <h2 className="text-2xl font-semibold tracking-[-0.015em]">
            No thesis on file
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Tell us what you&apos;re looking for and we&apos;ll match you with
            deals — sectors, countries, ticket size, in your own words.
          </p>
          <Link
            href="/thesis"
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Set up your thesis
            <ArrowRight />
          </Link>
        </div>
      ) : (
        <MatchesClient cachedMatches={cachedMatches} cachedAt={cachedAt} />
      )}
    </main>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
