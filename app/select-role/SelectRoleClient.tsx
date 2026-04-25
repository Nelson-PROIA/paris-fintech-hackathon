"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Who are you?
        </h1>
        <p className="text-muted-foreground">
          Pick a role. You can&apos;t change it later in this MVP.
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => pick("smb")}
          className="group flex flex-col gap-2 rounded-lg border border-border p-6 text-left transition hover:border-foreground hover:bg-accent disabled:opacity-50"
        >
          <span className="text-lg font-semibold">I&apos;m an SMB founder</span>
          <span className="text-sm text-muted-foreground">
            Onboard your business via conversation. Get matched with investors.
          </span>
          {submitting === "smb" && (
            <span className="mt-2 text-xs text-muted-foreground">
              Setting up…
            </span>
          )}
        </button>

        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => pick("investor")}
          className="group flex flex-col gap-2 rounded-lg border border-border p-6 text-left transition hover:border-foreground hover:bg-accent disabled:opacity-50"
        >
          <span className="text-lg font-semibold">I&apos;m an investor</span>
          <span className="text-sm text-muted-foreground">
            Browse curated SMB deals. Get AI-generated DD briefs. Build a
            portfolio.
          </span>
          {submitting === "investor" && (
            <span className="mt-2 text-xs text-muted-foreground">
              Setting up…
            </span>
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive">Could not save role: {error}</p>
      )}
    </main>
  );
}
