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

const SECTOR_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#6366f1",
];

export function PortfolioView({ result }: { result: PortfolioResult }) {
  const sectorData = Object.entries(result.diversification.bySector)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 sm:grid-cols-4">
        <Stat label="Capital deployed" value={fmtEur(result.totalDeployed)} />
        <Stat label="Of requested" value={fmtEur(result.totalRequested)} />
        <Stat label="Positions" value={result.positions.length.toString()} />
        <Stat
          label="Risk profile"
          value={result.expectedRiskProfile.toUpperCase()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Sector</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3 text-right">Allocation</th>
                <th className="px-4 py-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {result.positions.map((p) => (
                <tr
                  key={p.campaignId}
                  className="border-b border-border last:border-b-0 align-top"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/campaign/${p.campaignId}`}
                      className="font-medium hover:underline"
                    >
                      {p.campaign.company.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {p.campaign.title}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.rationale}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {p.campaign.company.sector ? (
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {p.campaign.company.sector}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.campaign.company.country ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmtEur(p.allocationEur)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {p.allocationPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By sector
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
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
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-xs">
            {sectorData.map((s, i) => (
              <li
                key={s.name}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="block h-2.5 w-2.5 rounded-full"
                    style={{
                      background: SECTOR_COLORS[i % SECTOR_COLORS.length],
                    }}
                  />
                  {s.name}
                </span>
                <span className="text-muted-foreground">{fmtEur(s.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
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
