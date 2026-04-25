import type { DDBrief } from "@/lib/ai/dd-analyst";

const SEVERITY_TEXT: Record<DDBrief["riskFlags"][number]["severity"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const SEVERITY_DOT: Record<DDBrief["riskFlags"][number]["severity"], string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
};

export function DDBriefView({
  brief,
  generatedAt,
  cached,
}: {
  brief: DDBrief;
  generatedAt: number;
  cached: boolean;
}) {
  return (
    <article className="space-y-6 rounded-lg border border-border p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-semibold">DD brief</h2>
          <p className="text-xs text-muted-foreground">
            {cached ? "cached" : "fresh"} · generated {fmtTime(generatedAt)}
          </p>
        </div>
        <SentimentPill score={brief.sentimentScore} />
      </header>

      <Section title="Overview" body={brief.overview} />
      <Section title="Traction" body={brief.traction} />
      <Section title="Team" body={brief.team} />
      <Section title="Market context" body={brief.marketContext} />

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Risk flags ({brief.riskFlags.length})
        </h3>
        {brief.riskFlags.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No material risks surfaced from this pass.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {brief.riskFlags.map((rf, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-md border border-border p-3"
              >
                <span
                  className={`mt-1 block h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_DOT[rf.severity]}`}
                  aria-label={SEVERITY_TEXT[rf.severity]}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {rf.flag}
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {SEVERITY_TEXT[rf.severity]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rf.evidence}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Sources ({brief.evidence.length})
        </h3>
        {brief.evidence.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No external sources cited.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {brief.evidence.map((e, i) => (
              <li key={i} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{e.source}</span>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {hostname(e.url)} ↗
                    </a>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.excerpt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </section>
  );
}

function SentimentPill({ score }: { score: number }) {
  const tone =
    score >= 70
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : score >= 40
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-400";
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-medium ${tone}`}
      title="0-100 confidence score"
    >
      Sentiment {score}
    </span>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}
