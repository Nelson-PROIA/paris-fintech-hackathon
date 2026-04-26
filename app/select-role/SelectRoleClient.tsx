"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SelectRoleClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<null | "smb" | "investor">(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(type: "smb" | "investor") {
    setSubmitting(type);
    setError(null);
    try {
      const res = await fetch("/api/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      router.push(type === "smb" ? "/onboard" : "/onboard-investor");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(null);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      {/* Aurora background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 gradient-aurora opacity-80"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-30 blur-3xl gradient-conic animate-spin-slow"
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10">
        <header className="space-y-3 text-center">
          <Badge variant="brand" className="mx-auto px-3 py-1">
            Welcome to Loanly
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Pick your{" "}
            <span className="serif-italic gradient-headline">side</span> of
            the table.
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Two roles. Pick one — you can&apos;t change it later in this MVP.
          </p>
        </header>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <RoleCard
            title="I'm an SMB founder"
            tagline="Raise capital, get matched"
            body="Onboard your business via a short conversation. Our AI structures your pitch and creates your first campaign. Investors come to you."
            tone="brand"
            features={[
              "AI-guided onboarding",
              "Auto-generated DD",
              "Live thesis matching",
            ]}
            disabled={submitting !== null}
            loading={submitting === "smb"}
            onClick={() => pick("smb")}
          />
          <RoleCard
            title="I'm an investor"
            tagline="Curated deal flow"
            body="Browse non-tech European SMBs. Get AI-generated DD briefs in under 30 seconds. Build a portfolio from your thesis."
            tone="violet"
            features={[
              "Thesis-ranked deals",
              "<30s DD briefs",
              "AI portfolio constructor",
            ]}
            disabled={submitting !== null}
            loading={submitting === "investor"}
            onClick={() => pick("investor")}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
            Could not save role: {error}
          </p>
        )}
      </div>
    </main>
  );
}

function RoleCard({
  title,
  tagline,
  body,
  features,
  tone,
  disabled,
  loading,
  onClick,
}: {
  title: string;
  tagline: string;
  body: string;
  features: string[];
  tone: "brand" | "violet";
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group surface-paper relative flex flex-col gap-4 overflow-hidden p-6 text-left transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-lift hover:border-brand/40",
        disabled && "opacity-60",
        loading && "ring-glow"
      )}
    >
      {/* Top hairline */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          tone === "brand"
            ? "bg-gradient-to-r from-transparent via-brand/60 to-transparent"
            : "bg-gradient-to-r from-transparent via-chart-4/60 to-transparent"
        )}
      />
      {/* Hover glow */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl opacity-0 transition group-hover:opacity-100",
          tone === "brand" ? "bg-brand/30" : "bg-chart-4/30"
        )}
      />

      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl shadow-soft ring-1 ring-inset ring-white/40",
            tone === "brand"
              ? "bg-gradient-to-br from-brand to-glow text-brand-foreground"
              : "bg-gradient-to-br from-chart-4 to-chart-4/60 text-white"
          )}
        >
          {tone === "brand" ? <FoundryIcon /> : <ChartIcon />}
        </span>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {tagline}
          </span>
          <h2 className="font-serif text-xl font-semibold leading-tight tracking-tight">
            {title}
          </h2>
        </div>
      </div>

      <p className="relative text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>

      <ul className="relative space-y-1.5 border-t border-border/60 pt-4 text-xs">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full",
                tone === "brand"
                  ? "bg-brand/15 text-brand"
                  : "bg-chart-4/15 text-chart-4"
              )}
            >
              <svg
                width="9"
                height="9"
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
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>

      <span className="relative mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-xs font-semibold">
        <span
          className={cn(
            "uppercase tracking-[0.18em]",
            tone === "brand" ? "text-brand" : "text-chart-4"
          )}
        >
          Continue →
        </span>
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand" />
            Setting up…
          </span>
        )}
      </span>
    </button>
  );
}

function FoundryIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
