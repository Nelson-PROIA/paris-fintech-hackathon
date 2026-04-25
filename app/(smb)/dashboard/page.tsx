import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listCampaignsByCompany, listCompaniesByUserId } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { SectorIcon } from "@/components/ui/sector-icon";
import { fmtEur, flagFor } from "@/lib/format";

export default async function SMBDashboardPage() {
  const user = await requireRole("smb");
  const companies = listCompaniesByUserId(user.id);

  // Aggregate stats
  const allCampaigns = companies.flatMap((co) =>
    listCampaignsByCompany(co.id).map((c) => ({ ...c, company: co }))
  );
  const openCampaigns = allCampaigns.filter((c) => c.status === "open");
  const fundedCampaigns = allCampaigns.filter((c) => c.status === "funded");
  const seeking = openCampaigns.reduce(
    (s, c) => s + (c.capital_seeking_eur ?? 0),
    0
  );
  const raised = fundedCampaigns.reduce(
    (s, c) => s + (c.capital_seeking_eur ?? 0),
    0
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="brand" className="mb-3">
            Founder dashboard
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            {companies.length === 0
              ? `Welcome, ${user.display_name ?? user.email.split("@")[0]}.`
              : "Your fundraising desk."}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {companies.length === 0
              ? "Spin up your first company to start matching with investors."
              : `${companies.length} compan${companies.length === 1 ? "y" : "ies"} · ${allCampaigns.length} campaign${allCampaigns.length === 1 ? "" : "s"} on the desk.`}
          </p>
        </div>
        <Link
          href="/onboard"
          className="gradient-brand inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-soft ring-1 ring-inset ring-white/20 hover:brightness-105"
        >
          <Plus />
          Add a company
        </Link>
      </header>

      {companies.length > 0 && (
        <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Capital seeking"
            value={fmtEur(seeking)}
            sub={`${openCampaigns.length} open`}
            tone="brand"
          />
          <StatCard
            label="Capital secured"
            value={fmtEur(raised)}
            sub={`${fundedCampaigns.length} funded`}
            tone="success"
          />
          <StatCard
            label="Active campaigns"
            value={openCampaigns.length.toString()}
            sub={
              openCampaigns.length === 0
                ? "none open"
                : `${openCampaigns.length} on the desk`
            }
          />
          <StatCard
            label="Companies"
            value={companies.length.toString()}
            sub={
              companies.length === 1
                ? "1 portfolio company"
                : `${companies.length} portfolio companies`
            }
          />
        </section>
      )}

      <section className="mt-8 space-y-5">
        {companies.length === 0 ? (
          <div className="surface flex flex-col items-center gap-3 p-10 text-center">
            <span className="text-3xl">🚀</span>
            <h2 className="text-lg font-semibold">No companies yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tell us about your business in a quick conversation. Our AI
              analyst structures your pitch and creates your first campaign.
            </p>
            <Link
              href="/onboard"
              className="gradient-brand mt-2 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-soft ring-1 ring-inset ring-white/20 hover:brightness-105"
            >
              Onboard your first company
              <ArrowRight />
            </Link>
          </div>
        ) : (
          companies.map((co) => {
            const campaigns = listCampaignsByCompany(co.id);
            return (
              <div key={co.id} className="surface space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <SectorIcon sector={co.sector} size="md" />
                    <div>
                      <Link
                        href={`/company/${co.id}`}
                        className="text-lg font-semibold tracking-tight hover:underline"
                      >
                        {co.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        {co.sector && <Badge variant="brand">{co.sector}</Badge>}
                        {co.stage && <Badge>{co.stage}</Badge>}
                        {co.country && (
                          <Badge variant="ghost">
                            {flagFor(co.country)} {co.country}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/company/${co.id}/new-campaign`}
                    className="rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    + New campaign
                  </Link>
                </div>
                {co.pitch && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {co.pitch}
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Campaigns ({campaigns.length})
                    </h3>
                  </div>
                  {campaigns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No campaigns yet. Add one to start raising.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
                      {campaigns.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/campaign/${c.id}`}
                            className="group flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-accent/40"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <StatusDot status={c.status} />
                              <span className="truncate font-medium">
                                {c.title}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                              <span className="tabular-nums">
                                {fmtEur(c.capital_seeking_eur)}
                              </span>
                              <Badge
                                variant={
                                  c.status === "open"
                                    ? "success"
                                    : c.status === "funded"
                                      ? "brand"
                                      : "default"
                                }
                              >
                                {c.status}
                              </Badge>
                              <span className="text-brand opacity-0 transition group-hover:opacity-100">
                                →
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "brand" | "success";
}) {
  return (
    <div className="surface relative overflow-hidden p-5">
      {tone && (
        <div
          className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${
            tone === "brand" ? "bg-brand/15" : "bg-success/15"
          }`}
        />
      )}
      <div className="relative">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-2 text-2xl font-semibold tabular-nums ${
            tone === "brand"
              ? "gradient-text"
              : tone === "success"
                ? "text-success"
                : ""
          }`}
        >
          {value}
        </div>
        {sub && (
          <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "open"
      ? "bg-success animate-pulse-soft"
      : status === "funded"
        ? "bg-brand"
        : "bg-muted-foreground/40";
  return (
    <span
      className={`block h-2 w-2 shrink-0 rounded-full ${cls}`}
      aria-label={status}
    />
  );
}

function Plus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
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
