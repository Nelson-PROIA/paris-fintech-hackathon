import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { LoanlyLogo } from "@/components/ui/loanly-mark";

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen items-stretch">
      <aside className="relative hidden w-[44%] flex-col justify-between border-r border-border bg-card/40 p-10 md:flex">
        <Link href="/" className="flex items-center transition hover:opacity-80">
          <LoanlyLogo size="md" />
        </Link>
        <div className="space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            Free during the hackathon
          </span>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em]">
            Three minutes to a{" "}
            <span className="text-brand">curated</span> deal flow.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Sign up free. Frame your thesis or onboard your business in a short
            conversation. The AI takes it from there.
          </p>
          <ul className="space-y-2 border-t border-border pt-5 text-sm">
            <Bullet>22 SMBs · 5 investor theses · 7 EU countries</Bullet>
            <Bullet>Agentic DD with cited web + registry sources</Bullet>
            <Bullet>Voice-driven natural language thesis</Bullet>
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
            className="flex items-center justify-center transition hover:opacity-80 md:hidden"
          >
            <LoanlyLogo size="md" />
          </Link>
          <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
            <SignUp
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none bg-transparent border-0",
                },
              }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            By signing up, you agree to our terms of service.
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
