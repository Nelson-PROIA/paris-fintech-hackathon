import { fmtEur } from "@/lib/format";

/**
 * Three-column "money flow" diagram. Tells the story of where the mEURC
 * sits at any moment of the lifecycle: in investors' wallets (uncommitted),
 * locked in the marketplace contract (escrow / awaiting disbursement /
 * repaying), or with the borrower (after disbursement, before repayment).
 *
 * All numbers are derived from the same on-chain reads as StatePanel — this
 * is purely a presentation layer.
 */
export function CashFlowPanel({
  state,
  targetEur,
  totalCommittedEur,
  totalRepaidEur,
  interestBps,
}: {
  state:
    | "open"
    | "funded"
    | "repaying"
    | "repaid"
    | "cancelled";
  targetEur: number;
  totalCommittedEur: number;
  totalRepaidEur: number;
  interestBps: number;
}) {
  const owedEur = totalCommittedEur * (1 + interestBps / 10000);
  const remainingHeadroom = Math.max(0, targetEur - totalCommittedEur);

  // Money in escrow (locked in marketplace contract) — only when commits are
  // accepted but disbursement hasn't happened yet.
  const escrowed = state === "open" ? totalCommittedEur : 0;
  // Money currently held by borrower (post-disbursement, pre-repayment).
  const withBorrower =
    state === "funded"
      ? targetEur
      : state === "repaying"
        ? Math.max(0, targetEur - totalRepaidEur)
        : 0;
  // Money already routed back to investors.
  const backToInvestors =
    state === "repaying" || state === "repaid"
      ? totalRepaidEur
      : state === "cancelled"
        ? totalCommittedEur
        : 0;

  const stepActive = (label: string): boolean => {
    if (state === "open") return label === "commit";
    if (state === "funded") return label === "disburse" || label === "borrower";
    if (state === "repaying") return label === "repay";
    if (state === "repaid") return label === "repay";
    if (state === "cancelled") return label === "refund";
    return false;
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Cash flow
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Where the mEURC actually sits in this lifecycle.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          all values in mEURC (≈ EUR)
        </span>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Box
          tone="emerald"
          title="Investors"
          subtitle="committed wallets"
          primary={fmtEur(totalCommittedEur)}
          detail={
            remainingHeadroom > 0 && state === "open"
              ? `still seeking ${fmtEur(remainingHeadroom)}`
              : "principal contributed"
          }
        />
        <Box
          tone="brand"
          title="Marketplace contract"
          subtitle="escrow / settlement"
          primary={fmtEur(escrowed)}
          detail={
            state === "open"
              ? `holding ${fmtEur(escrowed)} in escrow`
              : state === "funded"
                ? "released to borrower"
                : state === "repaying"
                  ? "passing through to investors"
                  : state === "repaid"
                    ? "cycle complete · contract empty"
                    : "refunded · contract empty"
          }
        />
        <Box
          tone={
            state === "repaid"
              ? "emerald"
              : state === "cancelled"
                ? "rose"
                : "amber"
          }
          title="Borrower"
          subtitle="working capital"
          primary={fmtEur(withBorrower)}
          detail={
            state === "funded"
              ? `owes ${fmtEur(Math.round(owedEur))} at maturity`
              : state === "repaying"
                ? `repaid ${fmtEur(totalRepaidEur)} so far`
                : state === "repaid"
                  ? "fully repaid"
                  : state === "cancelled"
                    ? "cancelled before disbursement"
                    : "awaiting disbursement"
          }
        />
      </div>

      <ol className="mt-6 grid gap-2 sm:grid-cols-4">
        <Step
          n={1}
          label="commit"
          title="Investor commits"
          active={stepActive("commit")}
          done={["funded", "repaying", "repaid"].includes(state)}
        />
        <Step
          n={2}
          label="disburse"
          title="Target hit · auto-disbursed"
          active={stepActive("disburse")}
          done={["repaying", "repaid"].includes(state)}
        />
        <Step
          n={3}
          label="repay"
          title="Borrower repays"
          active={stepActive("repay")}
          done={state === "repaid"}
        />
        <Step
          n={4}
          label="settle"
          title="Investors paid pro-rata"
          active={state === "repaid"}
          done={state === "repaid"}
        />
      </ol>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Total expected return for investors at maturity is{" "}
        <span className="font-semibold text-foreground">
          {fmtEur(Math.round(owedEur))}
        </span>{" "}
        ({fmtEur(totalCommittedEur)} principal +{" "}
        {fmtEur(Math.round(owedEur - totalCommittedEur))} interest at{" "}
        {(interestBps / 100).toFixed(2)}%) — pro-rated to each commitment.
        {state === "repaying" && (
          <>
            {" "}
            So far{" "}
            <span className="font-semibold text-foreground">
              {fmtEur(backToInvestors)}
            </span>{" "}
            has been routed to investors.
          </>
        )}
      </p>
    </section>
  );
}

function Box({
  tone,
  title,
  subtitle,
  primary,
  detail,
}: {
  tone: "emerald" | "brand" | "amber" | "rose";
  title: string;
  subtitle: string;
  primary: string;
  detail: string;
}) {
  const tones: Record<typeof tone, string> = {
    emerald:
      "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    brand: "border-brand/30 bg-brand-muted/40 text-foreground",
    amber:
      "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-80">
        {title}
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] opacity-60">
        {subtitle}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.02em] text-foreground">
        {primary}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function Step({
  n,
  label,
  title,
  active,
  done,
}: {
  n: number;
  label: string;
  title: string;
  active: boolean;
  done: boolean;
}) {
  const tone = done
    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
    : active
      ? "border-brand/40 bg-brand-muted/40 text-foreground"
      : "border-border bg-background/60 text-muted-foreground";
  return (
    <li
      data-label={label}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${tone}`}
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background font-mono text-[10px] tabular-nums">
        {n}
      </span>
      <span className="font-medium">{title}</span>
    </li>
  );
}
