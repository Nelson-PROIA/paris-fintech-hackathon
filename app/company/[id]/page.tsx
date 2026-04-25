import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getCompanyById,
  listCampaignsByCompany,
  listRatingsForUser,
} from "@/lib/db";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const company = getCompanyById(id);
  if (!company) notFound();

  const isOwner = company.user_id === user.id;
  const backHref = user.type === "investor" ? "/feed" : "/dashboard";
  const campaigns = listCampaignsByCompany(company.id);
  const ratings = listRatingsForUser(company.user_id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={backHref}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to {user.type === "investor" ? "feed" : "dashboard"}
      </Link>

      <header className="mt-6 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {company.name}
          </h1>
          <div className="flex items-center gap-2">
            {company.rating_count > 0 && (
              <span
                className="rounded-full bg-secondary px-3 py-0.5 text-xs"
                title={`${company.rating_count} ratings`}
              >
                ★ {company.rating_avg.toFixed(1)} ({company.rating_count})
              </span>
            )}
            {isOwner && (
              <span className="rounded-full border border-border px-3 py-0.5 text-xs text-muted-foreground">
                Your listing
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {company.sector && <Tag>{company.sector}</Tag>}
          {company.stage && <Tag>{company.stage}</Tag>}
          {company.country && <Tag>{company.country}</Tag>}
          {company.city && <Tag>{company.city}</Tag>}
        </div>
      </header>

      {company.pitch && (
        <section className="mt-6 rounded-lg border border-border p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            About
          </h2>
          <p className="mt-2 text-sm leading-relaxed">{company.pitch}</p>
        </section>
      )}

      <section className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border p-5 sm:grid-cols-3">
        <Field label="Founded" value={company.founded_year?.toString() ?? "—"} />
        <Field label="Team size" value={company.team_size?.toString() ?? "—"} />
        <Field
          label="MRR"
          value={
            company.monthly_revenue_eur
              ? fmtEur(company.monthly_revenue_eur)
              : "—"
          }
        />
        <Field
          label="Burn / mo"
          value={
            company.monthly_burn_eur ? fmtEur(company.monthly_burn_eur) : "—"
          }
        />
        <Field
          label="Website"
          value={
            company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {company.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              "—"
            )
          }
        />
      </section>

      <section id="campaigns" className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Campaigns ({campaigns.length})
          </h2>
          {isOwner && (
            <Link
              href={`/company/${company.id}/new-campaign`}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              + Add another campaign
            </Link>
          )}
        </div>
        {campaigns.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No campaigns yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campaign/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3 text-sm transition hover:border-foreground hover:bg-accent/30"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        c.status === "open"
                          ? "h-2 w-2 rounded-full bg-emerald-500"
                          : c.status === "funded"
                            ? "h-2 w-2 rounded-full bg-sky-500"
                            : "h-2 w-2 rounded-full bg-neutral-400"
                      }
                    />
                    <span className="font-medium">{c.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fmtEur(c.capital_seeking_eur)} · {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ratings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Recent ratings
          </h2>
          <ul className="mt-3 space-y-2">
            {ratings.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-border px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{"★".repeat(r.score)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1 text-muted-foreground">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
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

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
