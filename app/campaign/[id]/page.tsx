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
import { fmtEur, fmtEurExact, flagFor } from "@/lib/format";
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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <span aria-hidden>←</span>
        Back to {user.type === "investor" ? "feed" : "dashboard"}
      </Link>

      {/* Hero */}
      <section className="surface relative mt-5 overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 gradient-mesh opacity-20" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4">
              <SectorIcon sector={co.sector} size="lg" />
              <div>
                <Link
                  href={`/company/${co.id}`}
                  className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                >
                  {co.name}
                </Link>
                <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
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
              {co.sector && <Badge variant="brand">{co.sector}</Badge>}
              {co.stage && <Badge>{co.stage}</Badge>}
              <Badge variant="ghost">
                {flagFor(co.country)} {co.country ?? "—"}
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
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Capital seeking
            </div>
            <div className="gradient-text text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
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
            🌐 {co.website.replace(/^https?:\/\//, "")} ↗
          </a>
        </section>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <PanelSection title="Use of funds" icon="🎯">
          {camp.use_of_funds}
        </PanelSection>
        {camp.pitch_summary && (
          <PanelSection title="Pitch" icon="📣">
            {camp.pitch_summary}
          </PanelSection>
        )}
      </div>

      {/* Collateral */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Collateral{" "}
            <span className="text-sm text-muted-foreground">
              ({collaterals.length})
            </span>
          </h2>
          {isOwner && (
            <Link
              href={`/campaign/${camp.id}/manage`}
              className="text-xs text-brand underline-offset-2 hover:underline"
            >
              + Add collateral
            </Link>
          )}
        </div>
        {collaterals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
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
                  className="surface space-y-2 p-4 text-sm transition hover:border-brand/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{c.description}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {c.type} · {fmtEur(c.declared_value_eur)}
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
                    <p className="text-xs text-muted-foreground">
                      {verdict.summary}
                    </p>
                  )}
                  {verdict?.redFlags && verdict.redFlags.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-destructive">
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
    <div className="surface p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PanelSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{children}</p>
    </section>
  );
}

function ScorePill({ score }: { score: number }) {
  const variant: "success" | "warning" | "danger" =
    score >= 70 ? "success" : score >= 40 ? "warning" : "danger";
  return <Badge variant={variant}>AI score {score}</Badge>;
}
