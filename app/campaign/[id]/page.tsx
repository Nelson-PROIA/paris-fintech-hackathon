import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getCampaignWithCompany,
  getDb,
  getOnboardingForCompany,
  listCollateralsByCampaign,
  listRatingsForUser,
  parseCampaignMeta,
  type OnboardingDocument,
} from "@/lib/db";
import { DDSection } from "@/components/DDSection";
import { RatingWidget } from "@/components/RatingWidget";
import { CompanyOnboardingPanel } from "@/components/CompanyOnboardingPanel";
import type { DDBrief } from "@/lib/ai/dd-analyst";
import type { EnrichmentResult } from "@/lib/onboarding/types";

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type DDBriefRow = {
  id: number;
  company_id: string;
  brief_json: string;
  generated_at: number;
};

function getCachedDDBrief(companyId: string) {
  const row =
    (getDb()
      .prepare(
        "SELECT * FROM dd_briefs WHERE company_id = ? ORDER BY generated_at DESC LIMIT 1"
      )
      .get(companyId) as DDBriefRow | undefined) ?? null;
  if (!row) return null;
  if (Date.now() - row.generated_at > STALE_AFTER_MS) return null;
  return {
    brief: JSON.parse(row.brief_json) as DDBrief,
    generatedAt: row.generated_at,
    cached: true,
  };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const camp = getCampaignWithCompany(id);
  if (!camp) notFound();

  const co = camp.company;
  const isOwner = co.user_id === user.id;
  const backHref = user.type === "investor" ? "/feed" : "/dashboard";
  const collaterals = listCollateralsByCampaign(camp.id);
  const meta = parseCampaignMeta(camp);
  const cachedDD =
    user.type === "investor" ? getCachedDDBrief(co.id) : null;
  const ratings = listRatingsForUser(co.user_id);

  const onboarding = getOnboardingForCompany(co.id);
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
        ← Back to {user.type === "investor" ? "feed" : "dashboard"}
      </Link>

      <header className="mt-6 space-y-2">
        <Link
          href={`/company/${co.id}`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {co.name}
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {camp.title}
          </h1>
          <div className="flex items-center gap-2">
            <span
              className={
                camp.status === "open"
                  ? "rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
                  : camp.status === "funded"
                    ? "rounded-full bg-sky-500/15 px-3 py-0.5 text-xs text-sky-700 dark:text-sky-400"
                    : "rounded-full bg-secondary px-3 py-0.5 text-xs text-muted-foreground"
              }
            >
              {camp.status}
            </span>
            {co.rating_count > 0 && (
              <span className="rounded-full bg-secondary px-3 py-0.5 text-xs">
                ★ {co.rating_avg.toFixed(1)} ({co.rating_count})
              </span>
            )}
            {isOwner && (
              <span className="rounded-full border border-border px-3 py-0.5 text-xs text-muted-foreground">
                Your campaign
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {co.sector && <Tag>{co.sector}</Tag>}
          {co.stage && <Tag>{co.stage}</Tag>}
          {co.country && <Tag>{co.country}</Tag>}
          {co.city && <Tag>{co.city}</Tag>}
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Détail du besoin
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Field
            label="Montant"
            value={fmtEur(camp.capital_seeking_eur)}
          />
          {meta.duration_days != null && (
            <Field label="Durée" value={`${meta.duration_days} j`} />
          )}
          {meta.urgency && (
            <Field
              label="Urgence"
              value={URGENCY_LABEL[meta.urgency] ?? meta.urgency}
              tone={meta.urgency === "very_urgent" ? "warning" : undefined}
            />
          )}
          {meta.need_types && meta.need_types.length > 0 && (
            <Field
              label="Type(s)"
              value={meta.need_types
                .map((n) => NEED_LABEL[n] ?? n)
                .join(", ")}
            />
          )}
        </div>
        {(meta.need_description || camp.pitch_summary) && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {meta.need_description ?? camp.pitch_summary}
          </p>
        )}
        {!meta.need_types && (
          <p className="mt-3 text-xs italic text-muted-foreground">
            Cette campagne a été créée avant le nouveau format ; détails
            ci-dessous : {camp.use_of_funds}
          </p>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Collateral ({collaterals.length})
          </h2>
          {isOwner && (
            <Link
              href={`/campaign/${camp.id}/manage`}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              + Add collateral
            </Link>
          )}
        </div>
        {collaterals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No collateral on file.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {collaterals.map((c) => {
              const verdict = c.ai_verdict_json
                ? (JSON.parse(c.ai_verdict_json) as {
                    summary?: string;
                    matchesClaim?: string;
                    valuePlausible?: string;
                    redFlags?: string[];
                  })
                : null;
              return (
                <li
                  key={c.id}
                  className="space-y-2 rounded-md border border-border px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{c.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.type} · {fmtEur(c.declared_value_eur)}
                    </span>
                  </div>
                  {c.ai_score != null && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <ScorePill score={c.ai_score} />
                      {verdict?.matchesClaim && (
                        <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
                          claim: {verdict.matchesClaim}
                        </span>
                      )}
                      {verdict?.valuePlausible && (
                        <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
                          value: {verdict.valuePlausible}
                        </span>
                      )}
                    </div>
                  )}
                  {verdict?.summary && (
                    <p className="text-xs text-muted-foreground">
                      {verdict.summary}
                    </p>
                  )}
                  {verdict?.redFlags && verdict.redFlags.length > 0 && (
                    <ul className="text-xs text-rose-600 dark:text-rose-400">
                      {verdict.redFlags.map((f, i) => (
                        <li key={i}>⚠ {f}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {hasOnboardingData && (user.type === "investor" || isOwner) && (
        <section className="mt-8 space-y-2">
          <h2 className="text-lg font-semibold">Profil détaillé de la PME</h2>
          <p className="text-xs text-muted-foreground">
            Données collectées lors de l&apos;onboarding et enrichissement
            automatique (SIRENE + recherche web).
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

      {user.type === "investor" && (
        <section className="mt-8">
          <DDSection companyId={co.id} initialBrief={cachedDD} />
        </section>
      )}

      {user.type === "investor" && !isOwner && (
        <section className="mt-8">
          <RatingWidget ratedUserId={co.user_id} ratedType="smb" />
        </section>
      )}

      {ratings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Recent ratings
          </h2>
          <ul className="mt-3 space-y-2">
            {ratings.slice(0, 3).map((r) => (
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

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 70
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : score >= 40
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-400";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
      title="0-100 AI verification confidence"
    >
      AI score {score}
    </span>
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
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          tone === "warning"
            ? "mt-0.5 text-sm font-medium text-amber-700 dark:text-amber-400"
            : "mt-0.5 text-sm font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}

const NEED_LABEL: Record<string, string> = {
  invoice_advance: "Avance sur factures",
  working_capital: "BFR",
  stock_purchase: "Achat de stock",
  supplier_payment: "Paiement fournisseur",
  payroll: "Salaires",
  short_invest: "Investissement court",
  other: "Autre",
};

const URGENCY_LABEL: Record<string, string> = {
  very_urgent: "Très urgent (< 48 h)",
  this_week: "Cette semaine",
  this_month: "Ce mois",
  flexible: "Flexible",
};

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
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
