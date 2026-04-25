import Link from "next/link";
import { listCampaigns, listSectors, listCountries } from "@/lib/db";
import { FeedFilters } from "@/components/FeedFilters";
import { SectorIcon } from "@/components/ui/sector-icon";
import { Badge } from "@/components/ui/badge";
import { fmtEur, flagFor } from "@/lib/format";

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

  const totalSeeking = campaigns.reduce(
    (s, c) => s + (c.capital_seeking_eur ?? 0),
    0
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="brand" className="mb-3">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            Live deal flow
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            Deals on the desk today.
          </h1>
          <p className="mt-1 text-muted-foreground">
            {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
            {isFiltered && " matching your filters"} · {fmtEur(totalSeeking)}{" "}
            seeking total
          </p>
        </div>
        <Link
          href="/matches"
          className="surface inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:border-brand/40 hover:shadow-lift"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-brand animate-pulse-soft" />
          Show me my AI matches
          <ArrowRight />
        </Link>
      </header>

      <FeedFilters allSectors={allSectors} allCountries={allCountries} />

      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c, i) => (
          <li
            key={c.id}
            className={`animate-fade-in-up stagger-${Math.min((i % 5) + 1, 5)}`}
          >
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
        <div className="surface mt-12 flex flex-col items-center gap-2 p-12 text-center">
          <span className="text-3xl">🪶</span>
          <p className="text-base font-medium">Nothing matches those filters yet.</p>
          <p className="text-sm text-muted-foreground">Try widening sectors, countries, or ticket range.</p>
        </div>
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
      className="surface group relative flex h-full flex-col gap-4 overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift"
    >
      {/* Hover glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/10 opacity-0 blur-3xl transition group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SectorIcon sector={sector} size="md" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-tight">
              {companyName}
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {campaignTitle}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-2 py-0.5 text-[11px] font-medium">
            <span>{flagFor(country)}</span>
            <span>{country ?? "—"}</span>
          </span>
          {ratingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="text-warning">★</span>
              <span className="tabular-nums">{ratingAvg.toFixed(1)}</span>
              <span>({ratingCount})</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sector && <Badge variant="brand">{sector}</Badge>}
        {stage && <Badge>{stage}</Badge>}
      </div>

      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {pitch ?? "No description."}
      </p>

      <div className="mt-auto flex items-end justify-between border-t border-border/60 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Seeking
          </div>
          <div className="mt-0.5 gradient-text text-2xl font-semibold tabular-nums">
            {fmtEur(capitalSeeking)}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition group-hover:opacity-100">
          Open deal
          <ArrowRight />
        </span>
      </div>
    </Link>
  );
}

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
