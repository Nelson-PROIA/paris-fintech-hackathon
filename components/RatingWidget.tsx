"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RatingWidget({
  ratedUserId,
  ratedType,
}: {
  ratedUserId: string;
  ratedType: "smb" | "investor";
}) {
  const router = useRouter();
  const [score, setScore] = useState(0);
  const [hovering, setHovering] = useState(0);
  const [responsiveness, setResponsiveness] = useState(0);
  const [infoQuality, setInfoQuality] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (score < 1) return;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratedUserId,
          ratedType,
          score,
          dimensions: {
            ...(responsiveness ? { responsiveness } : {}),
            ...(infoQuality ? { info_quality: infoQuality } : {}),
          },
          comment: comment || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm">
        Thanks for the rating. It&apos;s now visible on this profile.
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Rate this {ratedType === "smb" ? "company" : "investor"}
      </h3>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovering(n)}
            onMouseLeave={() => setHovering(0)}
            onClick={() => setScore(n)}
            aria-label={`${n} stars`}
            className={
              (hovering ? n <= hovering : n <= score)
                ? "text-2xl text-amber-500"
                : "text-2xl text-muted-foreground hover:text-amber-400"
            }
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          {score === 0 ? "tap to rate" : `${score}/5`}
        </span>
      </div>

      <DimensionRow
        label="Responsiveness"
        value={responsiveness}
        onChange={setResponsiveness}
      />
      <DimensionRow
        label="Info quality"
        value={infoQuality}
        onChange={setInfoQuality}
      />

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        rows={2}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-xs text-destructive">{error}</span>}
        <button
          type="button"
          onClick={submit}
          disabled={score < 1 || status === "saving"}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === "saving" ? "Submitting…" : "Submit rating"}
        </button>
      </div>
    </section>
  );
}

function DimensionRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={
              n <= value
                ? "h-1.5 w-6 rounded-full bg-primary"
                : "h-1.5 w-6 rounded-full bg-border hover:bg-muted"
            }
            aria-label={`${label} ${n}`}
          />
        ))}
      </div>
    </div>
  );
}
