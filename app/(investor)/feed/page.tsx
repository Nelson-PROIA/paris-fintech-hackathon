import Link from "next/link";
import { listCampaigns, listSectors, listCountries } from "@/lib/db";
import { FeedFilters } from "@/components/FeedFilters";

type SearchParams = {
  sector?: string | string[];
  country?: string | string[];
  ticketMin?: string;
  ticketMax?: string;
};

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sectors = toArray(sp.sector);
  const countries = toArray(sp.country);
  const ticketMin = sp.ticketMin ? Number(sp.ticketMin) : undefined;
  const ticketMax = sp.ticketMax ? Number(sp.ticketMax) : undefined;

  const campaigns = listCampaigns({
    sectors: sectors.length ? sectors : undefined,
    countries: countries.length ? countries : undefined,
    ticketMin: Number.isFinite(ticketMin) ? ticketMin : undefined,
    ticketMax: Number.isFinite(ticketMax) ? ticketMax : undefined,
  });
  const allSectors = listSectors();
  const allCountries = listCountries();

  const isFiltered =
    sectors.length > 0 ||
    countries.length > 0 ||
    ticketMin != null ||
    ticketMax != null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Deal feed</h1>
        <p className="mt-1 text-muted-foreground">
          {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
          {isFiltered && " (filtered)"}
        </p>
      </header>

      <FeedFilters allSectors={allSectors} allCountries={allCountries} />

      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => (
          <li key={c.id}>
            <DealCard
              campaignId={c.id}
              campaignTitle={c.title}
              companyName={c.company.name}
              sector={c.company.sector}
              country={c.company.country}
              stage={c.company.stage}
              capitalSeeking={c.capital_seeking_eur}
              pitch={c.pitch_summary ?? c.company.pitch}
              ratingAvg={c.company.rating_avg}
              ratingCount={c.company.rating_count}
            />
          </li>
        ))}
      </ul>
      {campaigns.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          No campaigns match those filters. Try widening them.
        </p>
      )}
    </main>
  );
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function DealCard({
  campaignId,
  campaignTitle,
  companyName,
  sector,
  country,
  stage,
  capitalSeeking,
  pitch,
  ratingAvg,
  ratingCount,
}: {
  campaignId: string;
  campaignTitle: string;
  companyName: string;
  sector: string | null;
  country: string | null;
  stage: string | null;
  capitalSeeking: number;
  pitch: string | null;
  ratingAvg: number;
  ratingCount: number;
}) {
  return (
    <Link
      href={`/campaign/${campaignId}`}
      className="flex h-full flex-col gap-3 rounded-lg border border-border p-5 transition hover:border-foreground hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{companyName}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {campaignTitle}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {country ?? "—"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {sector && (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground">
            {sector}
          </span>
        )}
        {stage && (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground">
            {stage}
          </span>
        )}
        {ratingCount > 0 && (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground">
            ★ {ratingAvg.toFixed(1)} ({ratingCount})
          </span>
        )}
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">
        {pitch ?? "No description."}
      </p>
      <div className="mt-auto pt-2 text-sm font-medium">
        Seeking{" "}
        {new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(capitalSeeking)}
      </div>
    </Link>
  );
}
