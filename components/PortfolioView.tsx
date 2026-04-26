"use client";

import Link from "next/link";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { PortfolioResult } from "@/lib/ai/portfolio-constructor";
import { SectorIcon } from "@/components/ui/sector-icon";
import { Badge } from "@/components/ui/badge";
import { fmtEur, flagFor } from "@/lib/format";

// Brand-aligned chart palette using oklch tokens for visual consistency.
const SECTOR_COLORS = [
  "oklch(0.7 0.15 190)", // brand teal
  "oklch(0.68 0.16 155)", // success green
  "oklch(0.78 0.16 75)", // warning amber
  "oklch(0.62 0.18 290)", // chart-4 violet
  "oklch(0.65 0.2 25)", // chart-5 red
  "oklch(0.74 0.13 220)", // sky
  "oklch(0.7 0.18 340)", // pink
  "oklch(0.6 0.13 110)", // olive
];

export function PortfolioView({ result }: { result: PortfolioResult }) {
  const sectorData = Object.entries(result.diversification.bySector)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const totalDeployed = result.totalDeployed || 1;
  const deployedPct = result.totalRequested
    ? (result.totalDeployed / result.totalRequested) * 100
    : 100;

  const riskTone =
    result.expectedRiskProfile === "low"
      ? "success"
      : result.expectedRiskProfile === "high"
        ? "warning"
        : "brand";

  return (
    <section className="space-y-6">
      {/* Stats strip — banking-dashboard style */}
      <div className="surface-paper grid grid-cols-2 divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
        <Stat
          label="Capital deployed"
          value={fmtEur(result.totalDeployed)}
          accent="primary"
          sub={`${deployedPct.toFixed(0)}% of requested`}
        />
        <Stat
          label="Of requested"
          value={fmtEur(result.totalRequested)}
          sub="across positions"
        />
        <Stat
          label="Positions"
          value={result.positions.length.toString()}
          sub={
            result.positions.length === 1
              ? "single bet"
              : "diversified bets"
          }
        />
        <Stat
          label="Risk profile"
          value={result.expectedRiskProfile.toUpperCase()}
          tone={riskTone}
          sub="implied by mix"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Holdings table */}
        <div className="surface overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <h3 className="font-serif text-base font-semibold tracking-tight">
                Holdings
              </h3>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Allocation breakdown
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {result.positions.length}{" "}
              {result.positions.length === 1 ? "position" : "positions"}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Campaign</th>
                  <th className="px-3 py-2.5 font-medium">Sector</th>
                  <th className="px-3 py-2.5 font-medium">Country</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Allocation
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {result.positions.map((p, i) => {
                  const co = p.campaign.company;
                  const colour = SECTOR_COLORS[i % SECTOR_COLORS.length];
                  return (
                    <tr
                      key={p.campaignId}
                      className="border-t border-border/60 align-top transition hover:bg-accent/30"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-start gap-2.5">
                          <SectorIcon sector={co.sector} size="sm" />
                          <div className="min-w-0">
                            <Link
                              href={`/campaign/${p.campaignId}`}
                              className="block truncate font-medium hover:text-brand hover:underline-offset-2 hover:underline"
                            >
                              {co.name}
                            </Link>
                            <div className="truncate text-xs text-muted-foreground">
                              {p.campaign.title}
                            </div>
                            <p className="mt-1.5 line-clamp-2 max-w-md border-l border-brand/30 pl-2 text-xs leading-relaxed text-muted-foreground">
                              {p.rationale}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {co.sector ? (
                          <Badge variant="ghost" className="text-[10px]">
                            {co.sector}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <span>{flagFor(co.country)}</span>
                          <span>{co.country ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-serif text-[15px] font-semibold tabular-nums tracking-tight">
                          {fmtEur(p.allocationEur)}
                        </span>
                      </td>
                      <td className="w-32 px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="tabular-nums text-muted-foreground">
                            {p.allocationPct.toFixed(1)}%
                          </span>
                          <span className="relative block h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <span
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{
                                width: `${Math.min(100, p.allocationPct)}%`,
                                background: colour,
                              }}
                            />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border bg-muted/40 text-xs">
                <tr>
                  <td colSpan={3} className="px-5 py-2.5 font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Total deployed
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-serif text-base font-semibold tabular-nums tracking-tight">
                      {fmtEur(result.totalDeployed)}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground tabular-nums">
                    {result.positions
                      .reduce((s, p) => s + p.allocationPct, 0)
                      .toFixed(1)}
                    %
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Sector donut */}
        <div className="surface-paper relative space-y-4 overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
          <header className="relative">
            <h3 className="font-serif text-base font-semibold tracking-tight">
              By sector
            </h3>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Diversification mix
            </p>
          </header>
          <div className="relative h-56">
            {/* Centre stat */}
            <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Deployed
              </span>
              <span className="font-serif text-2xl font-semibold tabular-nums tracking-tight">
                {fmtEur(totalDeployed)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={84}
                  paddingAngle={3}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {sectorData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? fmtEur(value) : String(value)
                  }
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "var(--shadow-lift)",
                  }}
                  itemStyle={{ color: "var(--foreground)" }}
                  labelStyle={{
                    color: "var(--muted-foreground)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="relative space-y-2 text-xs">
            {sectorData.map((s, i) => {
              const pct = (s.value / totalDeployed) * 100;
              return (
                <li key={s.name} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card"
                    style={{
                      background: SECTOR_COLORS[i % SECTOR_COLORS.length],
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {s.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                  <span className="w-16 text-right tabular-nums">
                    {fmtEur(s.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "brand" | "success" | "warning";
  accent?: "primary";
}) {
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "brand"
          ? "text-brand"
          : accent === "primary"
            ? "gradient-headline"
            : "";
  return (
    <div className="relative p-5">
      {accent === "primary" && (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-px top-3 h-8 w-1 rounded-r-full bg-gradient-to-b from-brand to-chart-4"
        />
      )}
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1.5 font-serif text-2xl font-semibold tabular-nums tracking-tight ${valueClass}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}
