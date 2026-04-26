import type { DDBrief } from "@/lib/ai/dd-analyst";
import { Badge } from "@/components/ui/badge";


const SEVERITY_LABEL: Record<DDBrief["riskFlags"][number]["severity"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const SEVERITY_VARIANT: Record<
  DDBrief["riskFlags"][number]["severity"],
  "success" | "warning" | "danger"
> = {
  low: "success",
  medium: "warning",
  high: "danger",
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
    <article className="rounded-xl border border-border bg-card p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Due diligence
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
            Analyst report
          </h2>
          <p className="mt-1 flex items-center gap-2 text-xs">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                cached ? "bg-muted-foreground/40" : "bg-success animate-pulse-soft"
              }`}
            />
            <span className="text-muted-foreground">
              {cached ? "Cached" : "Fresh"} · {fmtTime(generatedAt)} ·{" "}
              {brief.evidence.length}{" "}
              {brief.evidence.length === 1 ? "source" : "sources"}
            </span>
          </p>
        </div>
        <SentimentBadge score={brief.sentimentScore} />
      </header>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Section title="Overview" body={brief.overview} wide />
        <Section title="Traction" body={brief.traction} />
        <Section title="Team" body={brief.team} />
        <Section title="Market context" body={brief.marketContext} wide />
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Risk flags
          </h3>
          <span className="text-xs text-muted-foreground">
            {brief.riskFlags.length}{" "}
            {brief.riskFlags.length === 1 ? "flag" : "flags"} surfaced
          </span>
        </div>
        {brief.riskFlags.length === 0 ? (
          <div className="mt-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
            No material risks surfaced from this pass.
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {brief.riskFlags.map((rf, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-card/60 p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY_VARIANT[rf.severity]}>
                    {SEVERITY_LABEL[rf.severity]}
                  </Badge>
                  <span className="text-sm font-medium">{rf.flag}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {rf.evidence}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sources
          </h3>
          <span className="text-xs text-muted-foreground">
            {brief.evidence.length}{" "}
            {brief.evidence.length === 1 ? "source" : "sources"} cited
          </span>
        </div>
        {brief.evidence.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No external sources cited.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {brief.evidence.map((e, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-card p-3 text-sm transition hover:border-foreground/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{e.source}</span>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand underline-offset-2 hover:underline"
                    >
                      {hostname(e.url)}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M7 17 17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </a>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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

function Section({
  title,
  body,
  wide,
}: {
  title: string;
  body: string;
  wide?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-border bg-card p-4 ${wide ? "md:col-span-2" : ""}`}
    >
      <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </section>
  );
}

function SentimentBadge({ score }: { score: number }) {
  const tone =
    score >= 70
      ? { ring: "border-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Strong" }
      : score >= 40
        ? { ring: "border-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10", label: "Mixed" }
        : { ring: "border-rose-500", text: "text-rose-700 dark:text-rose-400", bg: "bg-rose-500/10", label: "Cautious" };
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 ${tone.ring} ${tone.bg} ${tone.text}`}
      >
        <span className="text-base font-semibold leading-none tabular-nums">
          {score}
        </span>
        <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.16em] opacity-80">
          score
        </span>
      </span>
      <div className="text-right">
        <div className={`text-sm font-semibold ${tone.text}`}>{tone.label}</div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          conviction
        </div>
      </div>
    </div>
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
