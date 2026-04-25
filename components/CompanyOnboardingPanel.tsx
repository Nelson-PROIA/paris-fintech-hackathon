import type { EnrichmentResult } from "@/lib/onboarding/types";
import {
  computeRiskScore,
  gradeColorClass,
  type RiskScoreResult,
} from "@/lib/onboarding/risk-score";

const NEED_LABELS: Record<string, string> = {
  invoice_advance: "Invoice factoring",
  working_capital: "Working capital / cash flow",
  stock_purchase: "Inventory purchase",
  supplier_payment: "Supplier payment",
  payroll: "Payroll",
  short_invest: "Short-term investment",
  other: "Other",
};

const URGENCY_LABELS: Record<string, string> = {
  very_urgent: "Very urgent (< 48h)",
  this_week: "This week",
  this_month: "This month",
  flexible: "Flexible",
};

const DOC_CATEGORY_LABELS: Record<string, string> = {
  kbis: "KBIS / company registry",
  invoices: "Customer invoices",
  contracts: "Customer contracts",
  balance_sheet: "Balance sheet / accounts",
  bank_statements: "Bank statements",
  other: "Other",
};

type OnboardingDoc = {
  id: string;
  filename: string;
  url: string;
  mime: string;
  size: number;
  category: string | null;
  uploaded_at: number;
};

type Props = {
  data: Record<string, unknown>;
  documents: OnboardingDoc[];
  enrichment: EnrichmentResult | null;
};

export function CompanyOnboardingPanel({ data, documents, enrichment }: Props) {
  const score = computeRiskScore({ data, enrichment });
  return (
    <div className="space-y-6">
      <RiskScoreCard score={score} />
      <NeedSection data={data} />
      <OperationalSection data={data} />
      {enrichment && enrichment.source !== "none" && (
        <EnrichmentSection enrichment={enrichment} />
      )}
      <DocumentsSection documents={documents} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function RiskScoreCard({ score }: { score: RiskScoreResult }) {
  return (
    <section className="rounded-lg border border-border p-5">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-lg border text-3xl font-bold ${gradeColorClass(score.grade)}`}
        >
          {score.grade}
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <h2 className="text-base font-semibold">
              Short-term risk profile
            </h2>
            <p className="text-xs text-muted-foreground">
              Indicative score (non-binding) · {score.score} / 100
              · DSO + age + margin + SIRENE status
            </p>
          </div>
          <ul className="space-y-1 text-sm">
            {score.reasons.map((r, i) => (
              <li key={i} className="text-muted-foreground">
                · {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {(score.flags.length > 0 || score.positives.length > 0) && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Show all signals
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {score.positives.length > 0 && (
              <div>
                <div className="text-emerald-700 dark:text-emerald-400">
                  Strengths
                </div>
                <ul className="mt-1 space-y-0.5">
                  {score.positives.map((p, i) => (
                    <li key={i}>+ {p}</li>
                  ))}
                </ul>
              </div>
            )}
            {score.flags.length > 0 && (
              <div>
                <div className="text-rose-700 dark:text-rose-400">Concerns</div>
                <ul className="mt-1 space-y-0.5">
                  {score.flags.map((f, i) => (
                    <li key={i}>− {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

function NeedSection({ data }: { data: Record<string, unknown> }) {
  const needs = stringArrayOrNull(data.needs);
  const amount = numberOrNull(data.amount_eur);
  const duration = stringOrNull(data.duration_days);
  const urgency = stringOrNull(data.urgency);
  const desc = stringOrNull(data.need_description);

  if (!needs && !amount && !duration && !urgency && !desc) return null;

  return (
    <section className="rounded-lg border border-border p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Funding need
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {amount != null && (
          <Field label="Amount requested" value={fmtEur(amount)} />
        )}
        {duration && <Field label="Target duration" value={`${duration} d`} />}
        {urgency && (
          <Field
            label="Urgency"
            value={URGENCY_LABELS[urgency] ?? urgency}
            tone={urgency === "very_urgent" ? "warning" : undefined}
          />
        )}
        {needs && needs.length > 0 && (
          <Field
            label="Need type(s)"
            value={needs.map((n) => NEED_LABELS[n] ?? n).join(", ")}
          />
        )}
      </div>
      {desc && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {desc}
        </p>
      )}
    </section>
  );
}

function OperationalSection({ data }: { data: Record<string, unknown> }) {
  const dso = numberOrNull(data.dso_bucket);
  const margin = numberOrNull(data.gross_margin_bucket);
  const teamSize = numberOrNull(data.team_size_bucket);
  const ageMedian = numberOrNull(data.age_bucket);
  const monthlyRevenue = numberOrNull(data.monthly_revenue_bucket);
  const seasonality = stringOrNull(data.seasonality);
  const seasonalityNote = stringOrNull(data.seasonality_note);

  if (
    dso == null &&
    margin == null &&
    teamSize == null &&
    ageMedian == null &&
    monthlyRevenue == null
  )
    return null;

  return (
    <section className="rounded-lg border border-border p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Operational profile
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {dso != null && (
          <Field
            label="DSO (days sales outstanding)"
            value={`~ ${dso} d`}
            tone={dso >= 60 ? "warning" : dso < 30 ? "good" : undefined}
          />
        )}
        {margin != null && margin >= 0 && (
          <Field label="Gross margin" value={`~ ${margin} %`} />
        )}
        {monthlyRevenue != null && (
          <Field label="Monthly revenue" value={`~ ${fmtEur(monthlyRevenue)}`} />
        )}
        {teamSize != null && (
          <Field label="Team" value={`~ ${teamSize}`} />
        )}
        {ageMedian != null && (
          <Field label="Years in business" value={`~ ${ageMedian}`} />
        )}
        {seasonality && (
          <Field label="Seasonality" value={seasonality === "yes" ? "Yes" : "No"} />
        )}
      </div>
      {seasonality === "yes" && seasonalityNote && (
        <p className="mt-3 text-xs text-muted-foreground">
          Seasonality note: {seasonalityNote}
        </p>
      )}
    </section>
  );
}

function EnrichmentSection({ enrichment }: { enrichment: EnrichmentResult }) {
  return (
    <section className="rounded-lg border border-border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Enriched profile (background research)
        </h2>
        <span className="text-xs text-muted-foreground">
          source: {enrichment.source}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {enrichment.legal_name && (
          <Field label="Legal name" value={enrichment.legal_name} />
        )}
        {enrichment.siren && (
          <Field label="SIREN" value={enrichment.siren} />
        )}
        {enrichment.founded_date && (
          <Field label="Founded" value={enrichment.founded_date} />
        )}
        {enrichment.principal_activity && (
          <Field label="INSEE activity" value={enrichment.principal_activity} />
        )}
        {enrichment.address && (
          <Field label="Address" value={enrichment.address} />
        )}
        {enrichment.is_active != null && (
          <Field
            label="Status"
            value={enrichment.is_active ? "Active" : "INACTIVE"}
            tone={enrichment.is_active ? "good" : "warning"}
          />
        )}
      </dl>
      {enrichment.web_mentions.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Web mentions ({enrichment.web_mentions.length})
          </div>
          <ul className="space-y-1 text-xs">
            {enrichment.web_mentions.slice(0, 5).map((m) => (
              <li key={m.url}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground hover:underline"
                >
                  {m.title}
                </a>
                <span className="text-muted-foreground"> — {m.excerpt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DocumentsSection({ documents }: { documents: OnboardingDoc[] }) {
  if (documents.length === 0) return null;

  const grouped = new Map<string, OnboardingDoc[]>();
  for (const d of documents) {
    const key = d.category ?? "uncategorized";
    const arr = grouped.get(key) ?? [];
    arr.push(d);
    grouped.set(key, arr);
  }

  const ordered = Array.from(grouped.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <section className="rounded-lg border border-border p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Documents on file ({documents.length})
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Documents shared by the SMB — visible to authenticated investors.
      </p>
      <div className="mt-4 space-y-4">
        {ordered.map(([cat, docs]) => (
          <div key={cat}>
            <div className="text-xs font-medium text-muted-foreground">
              {DOC_CATEGORY_LABELS[cat] ?? cat} ({docs.length})
            </div>
            <ul className="mt-1 divide-y divide-border rounded-md border border-border">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                  >
                    {d.filename}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(d.size / 1024)} KB
                  </span>
                  <a
                    href={d.url}
                    download={d.filename}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warning";
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
            : tone === "good"
              ? "mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
              : "mt-0.5 text-sm font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function stringArrayOrNull(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const xs = v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return xs.length ? xs : null;
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
