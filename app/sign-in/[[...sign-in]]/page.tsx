import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { LoanlyMark } from "@/components/ui/loanly-mark";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen items-stretch">
      <aside className="relative hidden w-[44%] flex-col justify-between border-r border-border bg-card/40 p-10 md:flex">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]"
        >
          <LoanlyMark size={20} />
          Loanly
        </Link>
        <div className="space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Welcome back
          </span>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em]">
            Capital, routed to Europe&apos;s{" "}
            <span className="text-brand">real economy</span>.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Sign back in to your AI-curated deal flow, your portfolio
            constructor, and your live thesis matches.
          </p>
          <ul className="space-y-2 border-t border-border pt-5 text-sm">
            <Bullet>200+ live SMB campaigns ranked against your thesis</Bullet>
            <Bullet>Agentic DD briefs with cited sources, in &lt;30s</Bullet>
            <Bullet>Portfolio constructor with risk-aware allocation</Bullet>
          </ul>
        </div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          © Paris Fintech Hackathon
        </p>
      </aside>

      <section className="relative flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-6">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 text-[15px] font-semibold tracking-[-0.02em] md:hidden"
          >
            <LoanlyMark size={18} />
            Loanly
          </Link>
          <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none bg-transparent border-0",
                },
              }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our terms of service.
          </p>
        </div>
      </section>
    </main>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}
