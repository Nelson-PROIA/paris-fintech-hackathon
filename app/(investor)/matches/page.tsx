import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getInvestorByUserId } from "@/lib/db";
import { MatchesClient } from "./MatchesClient";

export default async function MatchesPage() {
  const user = await requireRole("investor");
  const investor = getInvestorByUserId(user.id);
  const hasThesis =
    !!investor?.thesis_text ||
    !!investor?.sectors_json ||
    !!investor?.countries_json;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Curated for you</h1>
        <p className="mt-1 text-muted-foreground">
          AI-ranked top deals for your thesis. Refreshed hourly.
        </p>
      </header>
      {!hasThesis ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h2 className="text-lg font-semibold">No thesis on file</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us what you&apos;re looking for and we&apos;ll match you with deals.
          </p>
          <Link
            href="/thesis"
            className="mt-4 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Set up your thesis
          </Link>
        </div>
      ) : (
        <MatchesClient />
      )}
    </main>
  );
}
