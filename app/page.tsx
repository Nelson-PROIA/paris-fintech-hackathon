import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getRoleFromClerk } from "@/lib/auth";
import { LoanlyMark } from "@/components/ui/loanly-mark";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    const { role } = await getRoleFromClerk(userId);
    if (role === "smb") redirect("/dashboard");
    if (role === "investor") redirect("/feed");
    redirect("/select-role");
  }

  return (
    <main className="relative">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]"
          >
            <LoanlyMark size={20} />
            Loanly
          </Link>
          <div className="flex items-center gap-2">
            <SignInButton mode="modal">
              <button className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-md bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition hover:opacity-90">
                Get started
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-24 sm:pt-32">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            Live AI matching · Mistral Large
          </span>
          <h1 className="mt-6 text-balance text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[56px] md:text-[64px]">
            Capital, finally routed to{" "}
            <span className="text-brand">Europe&apos;s real economy.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl">
            An AI-native marketplace that matches non-tech European SMBs raising
            short-term capital with thesis-driven angels, family offices, and
            search funds. Due diligence and collateral verification built in.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <SignUpButton mode="modal">
              <button className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-5 text-[15px] font-semibold text-background transition hover:opacity-90 active:translate-y-px">
                Get started — free
                <ArrowRight />
              </button>
            </SignUpButton>
            <Link
              href="#how"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-card px-5 text-[15px] font-medium transition hover:bg-accent"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            22 SMBs · 5 investor theses · 7 EU countries
          </p>
        </div>
      </section>

      <section
        id="how"
        className="border-t border-border bg-card/30 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              How it works
            </span>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Three minutes to a curated deal flow.
            </h2>
            <p className="mt-3 text-muted-foreground">
              We replaced spray-and-pray emails with structured matching. The
              AI does the boring 80%, you do the conviction 20%.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Step
              n="01"
              title="Frame your thesis"
              body="Sectors, geographies, ticket size, risk tolerance. In your own words. The agent extracts structure."
            />
            <Step
              n="02"
              title="Watch the match stream"
              body="Mistral Large ranks 200+ live campaigns against your thesis in real time, with one-line reasoning per pick."
            />
            <Step
              n="03"
              title="Diligence on tap"
              body="Each deal ships with an agentic DD brief — web search, registry lookup, traction signals — already done."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <Stat label="EU countries covered" value="7" />
            <Stat label="Avg. campaigns ranked / thesis" value="200+" />
            <Stat label="Time to first DD brief" value="< 30s" />
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <LoanlyMark size={16} />
            <span>© Loanly · Paris Fintech Hackathon</span>
          </div>
          <span>Built with Mistral Large · Next.js · Clerk</span>
        </div>
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="relative h-full rounded-lg border border-border bg-background p-6 transition hover:border-foreground/30">
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {n}
      </span>
      <h3 className="mt-2 text-lg font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-5xl font-semibold tracking-[-0.03em] tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
