"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewCampaignClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [capitalSeeking, setCapitalSeeking] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");
  const [pitchSummary, setPitchSummary] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim() || !capitalSeeking || !useOfFunds.trim()) {
      setError("Title, capital seeking, and use of funds are required.");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(`/api/company/${companyId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          capitalSeekingEur: Number(capitalSeeking),
          useOfFunds,
          pitchSummary: pitchSummary || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/campaign/${data.campaignId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="mt-8 space-y-4 rounded-lg border border-border p-5"
    >
      <Field label="Campaign title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Lyon expansion (€350k)"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Capital seeking (€)">
        <input
          type="number"
          value={capitalSeeking}
          onChange={(e) => setCapitalSeeking(e.target.value)}
          min={1000}
          step={10000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Use of funds">
        <textarea
          value={useOfFunds}
          onChange={(e) => setUseOfFunds(e.target.value)}
          placeholder="e.g. Open second roastery (€220k), 3 sales hires (€90k), inventory (€40k)."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Campaign pitch (optional)">
        <textarea
          value={pitchSummary}
          onChange={(e) => setPitchSummary(e.target.value)}
          placeholder="2–3 sentences about why this raise + what you've built so far."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-xs text-destructive">{error}</span>}
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Create campaign"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
