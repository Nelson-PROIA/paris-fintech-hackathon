import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listCampaignsByCompany, listCompaniesByUserId } from "@/lib/db";

export default async function SMBDashboardPage() {
  const user = await requireRole("smb");
  const companies = listCompaniesByUserId(user.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {companies.length === 0
              ? `Welcome, ${user.display_name ?? user.email}.`
              : `${companies.length} compan${companies.length === 1 ? "y" : "ies"} on file.`}
          </p>
        </div>
        <Link
          href="/onboard"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + Add a company
        </Link>
      </div>

      <section className="mt-10 space-y-6">
        {companies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <h2 className="text-lg font-semibold">No companies yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us about your business in a quick conversation.
            </p>
            <Link
              href="/onboard"
              className="mt-4 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Onboard your first company
            </Link>
          </div>
        ) : (
          companies.map((co) => {
            const campaigns = listCampaignsByCompany(co.id);
            return (
              <div
                key={co.id}
                className="space-y-4 rounded-lg border border-border p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <Link
                    href={`/company/${co.id}`}
                    className="text-xl font-semibold hover:underline"
                  >
                    {co.name}
                  </Link>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {co.sector && <Tag>{co.sector}</Tag>}
                    {co.stage && <Tag>{co.stage}</Tag>}
                    {co.country && <Tag>{co.country}</Tag>}
                  </div>
                </div>
                {co.pitch && (
                  <p className="text-sm text-muted-foreground">{co.pitch}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Campaigns ({campaigns.length})
                    </h3>
                    <Link
                      href={`/company/${co.id}#campaigns`}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      manage →
                    </Link>
                  </div>
                  {campaigns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No active campaigns. Add one from the company page.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {campaigns.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/campaign/${c.id}`}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-accent"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={
                                  c.status === "open"
                                    ? "block h-2 w-2 rounded-full bg-emerald-500"
                                    : c.status === "funded"
                                      ? "block h-2 w-2 rounded-full bg-sky-500"
                                      : "block h-2 w-2 rounded-full bg-neutral-400"
                                }
                              />
                              <span className="font-medium">{c.title}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fmtEur(c.capital_seeking_eur)} · {c.status}
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground">
      {children}
    </span>
  );
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
