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
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10">
        <header className="space-y-3 text-center">
          <Badge variant="brand" className="mx-auto px-3 py-1">
            Welcome to Loanly
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.025em] sm:text-5xl">
            Pick your side of the table.
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
  disabled,
  loading,
  onClick,
}: {
  title: string;
  tagline: string;
  body: string;
  features: string[];
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
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-left transition hover:border-foreground/30",
        disabled && "opacity-60"
      )}
    >
      <div className="space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {tagline}
        </span>
        <h2 className="text-xl font-semibold leading-tight tracking-[-0.015em]">
          {title}
        </h2>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>

      <ul className="space-y-1.5 border-t border-border pt-4 text-xs">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="text-brand"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>

      <span className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs font-semibold">
        <span className="uppercase tracking-[0.18em] text-brand">
          Continue
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
