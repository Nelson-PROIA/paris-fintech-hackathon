import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listCampaignsByCompany, listCompaniesByUserId } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { SectorIcon } from "@/components/ui/sector-icon";
import { fmtEur, humanize } from "@/lib/format";

export default async function SMBDashboardPage() {
  const user = await requireRole("smb");
  const companies = listCompaniesByUserId(user.id);

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
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Founder dashboard
          </p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.025em]">
            {companies.length === 0
              ? `Welcome, ${user.display_name ?? user.email.split("@")[0]}.`
              : "Your fundraising desk."}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {companies.length === 0
              ? "Spin up your first company to start matching with investors."
              : `${companies.length} compan${companies.length === 1 ? "y" : "ies"} · ${allCampaigns.length} campaign${allCampaigns.length === 1 ? "" : "s"} on the desk.`}
          </p>
        </div>
        <Link
          href="/onboard?force=1"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 active:translate-y-px"
        >
          <Plus />
          Add a company
        </Link>
      </header>

      {companies.length > 0 && (
        <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Capital seeking"
            value={fmtEur(seeking)}
            sub={`${openCampaigns.length} open`}
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

      <section className="mt-8 space-y-4">
        {companies.length === 0 ? (
          <div className="surface flex flex-col items-center gap-3 p-12 text-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Get started
            </span>
            <h2 className="text-2xl font-semibold tracking-[-0.02em]">
              No companies yet
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tell us about your business in a quick conversation. The AI
              structures your pitch and creates your first campaign.
            </p>
            <Link
              href="/onboard?force=1"
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Onboard your first company
              <ArrowRight />
            </Link>
          </div>
        ) : (
          companies.map((co) => {
            const campaigns = listCampaignsByCompany(co.id);
            return (
              <div
                key={co.id}
                className="surface space-y-4 p-6 transition hover:border-foreground/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <SectorIcon sector={co.sector} size="md" />
                    <div>
                      <Link
                        href={`/company/${co.id}`}
                        className="text-xl font-semibold tracking-[-0.015em] hover:underline-offset-2 hover:underline"
                      >
                        {co.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {co.sector && (
                          <Badge variant="brand">{humanize(co.sector)}</Badge>
                        )}
                        {co.stage && <Badge>{humanize(co.stage)}</Badge>}
                        {co.country && (
                          <Badge variant="outline">{co.country}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/company/${co.id}/new-campaign`}
                    className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
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
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Campaigns ({campaigns.length})
                  </h3>
                  {campaigns.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                      No campaigns yet. Add one to start raising.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {campaigns.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/campaign/${c.id}`}
                            className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-accent/50"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <StatusDot status={c.status} />
                              <span className="truncate font-medium">
                                {c.title}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-semibold tabular-nums text-foreground">
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
                                {humanize(c.status)}
                              </Badge>
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
  tone?: "success";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-[-0.02em] ${
          tone === "success" ? "text-emerald-600 dark:text-emerald-400" : ""
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "open"
      ? "bg-emerald-500"
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
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
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
