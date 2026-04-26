import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getCampaignWithCompany,
  getDb,
  listCollateralsByCampaign,
  listRatingsForUser,
} from "@/lib/db";
import { DDSection } from "@/components/DDSection";
import { RatingWidget } from "@/components/RatingWidget";
import { Badge } from "@/components/ui/badge";
import { SectorIcon } from "@/components/ui/sector-icon";
import { fmtEur, fmtEurExact, humanize } from "@/lib/format";
import type { DDBrief } from "@/lib/ai/dd-analyst";

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
  const cachedDD =
    user.type === "investor" ? getCachedDDBrief(co.id) : null;
  const ratings = listRatingsForUser(co.user_id);

  const statusVariant =
    camp.status === "open"
      ? "success"
      : camp.status === "funded"
        ? "brand"
        : "default";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <span aria-hidden>←</span>
        Back to {user.type === "investor" ? "feed" : "dashboard"}
      </Link>

      {/* Hero */}
      <section className="mt-5 rounded-xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4">
              <SectorIcon sector={co.sector} size="lg" />
              <div>
                <Link
                  href={`/company/${co.id}`}
                  className="text-xs uppercase tracking-[0.18em] text-muted-foreground underline-offset-2 hover:text-brand hover:underline"
                >
                  {co.name}
                </Link>
                <h1 className="mt-1 text-balance text-3xl font-semibold tracking-[-0.025em] md:text-4xl">
                  {camp.title}
                </h1>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Badge variant={statusVariant}>
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    camp.status === "open"
                      ? "bg-success animate-pulse-soft"
                      : "bg-current"
                  }`}
                />
                {camp.status}
              </Badge>
              {co.sector && <Badge variant="brand">{humanize(co.sector)}</Badge>}
              {co.stage && <Badge>{humanize(co.stage)}</Badge>}
              <Badge variant="ghost">
                {co.country ?? "—"}
                {co.city ? ` · ${co.city}` : ""}
              </Badge>
              {co.rating_count > 0 && (
                <Badge variant="warning">
                  ★ {co.rating_avg.toFixed(1)} ({co.rating_count})
                </Badge>
              )}
              {isOwner && <Badge variant="outline">Your campaign</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Capital seeking
            </div>
            <div className="text-4xl font-semibold tracking-[-0.025em] tabular-nums md:text-5xl">
              {fmtEur(camp.capital_seeking_eur)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground tabular-nums">
              {fmtEurExact(camp.capital_seeking_eur)}
            </div>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Founded" value={co.founded_year?.toString() ?? "—"} />
        <Stat label="Team size" value={co.team_size?.toString() ?? "—"} />
        <Stat
          label="MRR"
          value={co.monthly_revenue_eur ? fmtEur(co.monthly_revenue_eur) : "—"}
        />
        <Stat
          label="Burn / mo"
          value={co.monthly_burn_eur ? fmtEur(co.monthly_burn_eur) : "—"}
        />
      </section>

      {co.website && (
        <section className="mt-3">
          <a
            href={co.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-brand underline-offset-2 hover:underline"
          >
            {co.website.replace(/^https?:\/\//, "")}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </section>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <PanelSection title="Use of funds">{camp.use_of_funds}</PanelSection>
        {camp.pitch_summary && (
          <PanelSection title="Pitch">{camp.pitch_summary}</PanelSection>
        )}
      </div>

      {/* Collateral */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-[-0.015em]">
            Collateral{" "}
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              ({collaterals.length} on file)
            </span>
          </h2>
          {isOwner && (
            <Link
              href={`/campaign/${camp.id}/manage`}
              className="rounded-md border border-border bg-card/60 px-3 py-1 text-xs font-medium transition hover:border-brand/30 hover:bg-accent"
            >
              + Add collateral
            </Link>
          )}
        </div>
        {collaterals.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            No collateral on file.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
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
                  className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm transition hover:border-foreground/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <CollateralIcon type={c.type} />
                      {c.description}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                        {humanize(c.type)}
                      </span>
                      <span className="ml-2 text-base font-semibold tabular-nums tracking-[-0.01em] text-foreground">
                        {fmtEur(c.declared_value_eur)}
                      </span>
                    </span>
                  </div>
                  {c.ai_score != null && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <ScorePill score={c.ai_score} />
                      {verdict?.matchesClaim && (
                        <Badge>claim: {verdict.matchesClaim}</Badge>
                      )}
                      {verdict?.valuePlausible && (
                        <Badge>value: {verdict.valuePlausible}</Badge>
                      )}
                    </div>
                  )}
                  {verdict?.summary && (
                    <p className="border-l-2 border-brand/30 pl-3 text-xs leading-relaxed text-muted-foreground">
                      {verdict.summary}
                    </p>
                  )}
                  {verdict?.redFlags && verdict.redFlags.length > 0 && (
                    <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                      {verdict.redFlags.map((f, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span aria-hidden className="font-mono">!</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {user.type === "investor" && (
        <section className="mt-10">
          <DDSection companyId={co.id} initialBrief={cachedDD} />
        </section>
      )}

      {user.type === "investor" && !isOwner && (
        <section className="mt-8">
          <RatingWidget ratedUserId={co.user_id} ratedType="smb" />
        </section>
      )}

      {ratings.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent ratings
          </h2>
          <ul className="mt-3 space-y-2">
            {ratings.slice(0, 3).map((r) => (
              <li key={r.id} className="surface p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-warning">{"★".repeat(r.score)}</span>
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums tracking-[-0.015em]">
        {value}
      </div>
    </div>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
        {children}
      </p>
    </section>
  );
}

function ScorePill({ score }: { score: number }) {
  const variant: "success" | "warning" | "danger" =
    score >= 70 ? "success" : score >= 40 ? "warning" : "danger";
  return <Badge variant={variant}>AI score {score}</Badge>;
}

function CollateralIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  const label = t.includes("invoice")
    ? "INV"
    : t.includes("inventory")
      ? "INV"
      : t.includes("equipment") || t.includes("machine")
        ? "EQP"
        : t.includes("real") || t.includes("estate")
          ? "RE"
          : t.includes("contract")
            ? "CTR"
            : "DOC";
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
      aria-hidden
    >
      {label}
    </span>
  );
}
