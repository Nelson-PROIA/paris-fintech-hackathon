import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getRoleFromClerk } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    const { role } = await getRoleFromClerk(userId);
    if (role === "smb") redirect("/dashboard");
    if (role === "investor") redirect("/feed");
    redirect("/select-role");
  }

  return (
    <main className="relative overflow-hidden">
      {/* Top nav for landing */}
      <header className="glass-strong sticky top-0 z-40 border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg gradient-brand text-[12px] font-bold text-brand-foreground shadow-soft">
              <span className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/30" />
              <span className="relative">L</span>
            </span>
            <span>Loanly</span>
          </div>
          <div className="flex items-center gap-2">
            <SignInButton mode="modal">
              <button className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="gradient-brand rounded-md px-3.5 py-1.5 text-sm font-semibold text-brand-foreground shadow-soft ring-1 ring-inset ring-white/20 hover:brightness-105">
                Get started
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[680px] gradient-mesh opacity-80" />
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in-up">
              <Badge variant="brand" className="mx-auto">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                </span>
                Live AI matching · Mistral Large
              </Badge>
            </div>
            <h1 className="animate-fade-in-up stagger-1 mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Capital, finally{" "}
              <span className="gradient-text">routed</span> to Europe&apos;s real economy.
            </h1>
            <p className="animate-fade-in-up stagger-2 mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
              An AI-native marketplace that matches non-tech SMBs raising capital
              with thesis-driven angels, family offices and search funds —
              with due diligence built in.
            </p>
            <div className="animate-fade-in-up stagger-3 mt-10 flex flex-wrap items-center justify-center gap-3">
              <SignUpButton mode="modal">
                <button className="gradient-brand inline-flex h-12 items-center gap-2 rounded-xl px-6 text-base font-semibold text-brand-foreground shadow-lift ring-1 ring-inset ring-white/25 transition hover:brightness-105 active:translate-y-px">
                  Get started — free
                  <ArrowRight />
                </button>
              </SignUpButton>
              <Link
                href="#how"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-card/60 px-6 text-base font-medium backdrop-blur transition hover:bg-card"
              >
                See it in action
              </Link>
            </div>
            <p className="animate-fade-in-up stagger-4 mt-6 text-xs uppercase tracking-widest text-muted-foreground">
              22 SMBs · 5 investor theses · 7 EU countries
            </p>
          </div>

          {/* Floating preview cards */}
          <div className="relative mx-auto mt-20 max-w-5xl">
            <div className="grid gap-5 sm:grid-cols-3">
              <PreviewCard
                delay="stagger-2"
                emoji="☕"
                hue={35}
                name="Atelier Paris Coffee"
                country="🇫🇷 FR"
                sector="Beverage"
                fit={92}
                seeking="€350k"
                pitch="Specialty roastery scaling B2B wholesale across Île-de-France with two 3-yr contracts inked."
              />
              <PreviewCard
                delay="stagger-3"
                emoji="⚡"
                hue={190}
                name="Meridian Compliance"
                country="🇳🇱 NL"
                sector="B2B SaaS"
                fit={88}
                seeking="€200k"
                pitch="GDPR co-pilot for mid-market law firms, €18k MRR, 140% net retention since launch."
                featured
              />
              <PreviewCard
                delay="stagger-4"
                emoji="🛠️"
                hue={30}
                name="Norddeutsche Werke"
                country="🇩🇪 DE"
                sector="Manufacturing"
                fit={81}
                seeking="€480k"
                pitch="Family-run precision parts shop replacing two CNC machines, 12-yr aerospace tier-2 supplier."
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/60 bg-card/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline">How it works</Badge>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight">
              Three minutes to a curated deal flow.
            </h2>
            <p className="mt-3 text-muted-foreground">
              We replaced spray-and-pray emails with structured matching.
              The AI does the boring 80%, you do the conviction 20%.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
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

      {/* Trust */}
      <section className="border-t border-border/60 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <Stat label="EU countries covered" value="7" />
            <Stat label="Avg. campaigns ranked / thesis" value="200+" />
            <Stat label="Time to first DD brief" value="< 30s" />
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© Loanly — Paris Fintech Hackathon</span>
          <span>Built with Mistral Large · Next.js 15 · Clerk</span>
        </div>
      </footer>
    </main>
  );
}

function PreviewCard({
  delay,
  emoji,
  hue,
  name,
  country,
  sector,
  fit,
  seeking,
  pitch,
  featured,
}: {
  delay: string;
  emoji: string;
  hue: number;
  name: string;
  country: string;
  sector: string;
  fit: number;
  seeking: string;
  pitch: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`animate-fade-in-up ${delay} surface-lift relative flex flex-col gap-3 p-5 ${
        featured ? "ring-glow md:-translate-y-3 md:scale-[1.02]" : "animate-float-slow"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl ring-1 ring-inset ring-white/40 shadow-soft"
            style={{
              backgroundImage: `linear-gradient(135deg, oklch(0.92 0.08 ${hue}), oklch(0.78 0.16 ${hue}))`,
            }}
          >
            {emoji}
          </span>
          <div>
            <div className="text-sm font-semibold leading-tight">{name}</div>
            <div className="text-[11px] text-muted-foreground">{country} · {sector}</div>
          </div>
        </div>
        <FitGauge score={fit} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{pitch}</p>
      <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Seeking</span>
        <span className="text-base font-semibold tabular-nums">{seeking}</span>
      </div>
    </div>
  );
}

function FitGauge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "text-success border-success/40 bg-success/10"
      : score >= 60
        ? "text-brand border-brand/40 bg-brand-muted"
        : "text-warning border-warning/40 bg-warning/10";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      <span>★</span>
      <span className="tabular-nums">{score}</span>
    </span>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="surface-lift relative flex h-full flex-col gap-2 p-6">
      <span className="font-mono text-xs text-muted-foreground">{n}</span>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="gradient-text text-5xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
