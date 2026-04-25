import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getCompanyById,
  getOnboardingForCompany,
  listCampaignsByCompany,
  listRatingsForUser,
  type OnboardingDocument,
} from "@/lib/db";
import { CompanyOnboardingPanel } from "@/components/CompanyOnboardingPanel";
import type { EnrichmentResult } from "@/lib/onboarding/types";

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

  const onboarding = getOnboardingForCompany(company.id);
  const onboardingData = onboarding ? safeParseObject(onboarding.data_json) : {};
  const onboardingDocs: OnboardingDocument[] = onboarding
    ? safeParseArray<OnboardingDocument>(onboarding.documents_json)
    : [];
  const onboardingEnrichment: EnrichmentResult | null = onboarding?.enrichment_json
    ? (safeParseObject(onboarding.enrichment_json) as EnrichmentResult)
    : null;
  const hasOnboardingData =
    Object.keys(onboardingData).length > 0 ||
    onboardingDocs.length > 0 ||
    onboardingEnrichment !== null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={backHref}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour {user.type === "investor" ? "au feed" : "au dashboard"}
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
                Ton entreprise
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
            Pitch
          </h2>
          <p className="mt-2 text-sm leading-relaxed">{company.pitch}</p>
        </section>
      )}

      {hasOnboardingData && (
        <section className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold">
            {isOwner ? "Ton profil entreprise" : "Profil détaillé"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isOwner
              ? "Voici ce que voient les prêteurs sur ton profil. Pour le mettre à jour, retourne sur /onboard."
              : "Données collectées lors de l'onboarding et enrichissement automatique (SIRENE + recherche web)."}
          </p>
          <div className="mt-3">
            <CompanyOnboardingPanel
              data={onboardingData}
              documents={onboardingDocs}
              enrichment={onboardingEnrichment}
            />
          </div>
        </section>
      )}

      <section id="campaigns" className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Campagnes de financement ({campaigns.length})
          </h2>
          {isOwner && (
            <Link
              href={`/company/${company.id}/new-campaign`}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              + Demander un financement
            </Link>
          )}
        </div>
        {campaigns.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aucune campagne pour le moment.
            {isOwner && (
              <>
                <br />
                <Link
                  href={`/company/${company.id}/new-campaign`}
                  className="mt-3 inline-block rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  Lancer ta première demande
                </Link>
              </>
            )}
          </div>
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
            Évaluations récentes
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

function safeParseObject(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function safeParseArray<T>(s: string | null): T[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
