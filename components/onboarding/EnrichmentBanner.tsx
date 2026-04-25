"use client";

import { useState } from "react";
import type {
  EnrichmentResult,
  EnrichmentStatus,
} from "@/lib/onboarding/types";

type Props = {
  status: EnrichmentStatus;
  result: EnrichmentResult | null;
  onApplySuggestions: (patch: Record<string, unknown>) => void;
};

export function EnrichmentBanner({
  status,
  result,
  onApplySuggestions,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (status === "idle") return null;
  if (dismissed) return null;

  if (status === "running") {
    return (
      <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm">
        <span className="font-medium">Background research…</span>{" "}
        <span className="text-muted-foreground">
          Querying SIRENE and the web to pre-fill some fields.
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive">
        Background research unavailable. You can continue without it; we&apos;ll
        retry later.
      </div>
    );
  }

  if (status !== "done" || !result) return null;

  const hasContent =
    result.siren ||
    result.founded_year ||
    result.principal_activity ||
    result.address ||
    result.web_mentions.length > 0;

  if (!hasContent) {
    return (
      <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm">
        <span className="font-medium">Research complete.</span>{" "}
        <span className="text-muted-foreground">
          No useful public info found on this company.
        </span>
      </div>
    );
  }

  const suggestions: Array<{ label: string; patch: Record<string, unknown> }> =
    [];
  if (result.founded_year != null) {
    const ageBucket = result.suggested_fields?.age_bucket_suggested as
      | number
      | undefined;
    if (ageBucket != null) {
      suggestions.push({
        label: `Pre-fill age (founded ${result.founded_year})`,
        patch: { age_bucket: ageBucket },
      });
    }
  }
  if (result.address) {
    const cityMatch = result.address.match(/\d{5}\s+([^,]+)/);
    const city = cityMatch?.[1]?.trim();
    if (city) {
      suggestions.push({
        label: `Pre-fill city: ${city}`,
        patch: { city },
      });
    }
  }
  if (result.siren) {
    suggestions.push({
      label: `Confirm SIREN: ${result.siren}`,
      patch: { siret: result.siren },
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Enriched profile
          </div>
          <p className="mt-0.5 text-sm">
            We found{" "}
            {[
              result.legal_name && `the legal name`,
              result.founded_year && `the founding year`,
              result.principal_activity && `the principal activity`,
              result.address && `the address`,
              result.web_mentions.length > 0 &&
                `${result.web_mentions.length} web mention${result.web_mentions.length === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-muted-foreground hover:underline"
        >
          hide
        </button>
      </div>

      <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {result.legal_name && (
          <Row label="Legal name" value={result.legal_name} />
        )}
        {result.siren && <Row label="SIREN" value={result.siren} />}
        {result.founded_date && (
          <Row label="Founded" value={result.founded_date} />
        )}
        {result.principal_activity && (
          <Row label="INSEE activity" value={result.principal_activity} />
        )}
        {result.address && <Row label="Address" value={result.address} />}
        {result.is_active != null && (
          <Row
            label="Status"
            value={result.is_active ? "Active" : "Inactive"}
          />
        )}
      </dl>

      {result.web_mentions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Web mentions
          </div>
          <ul className="space-y-1 text-xs">
            {result.web_mentions.slice(0, 3).map((m) => (
              <li key={m.url}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground hover:underline"
                >
                  {m.title}
                </a>
                <span className="text-muted-foreground"> — {m.excerpt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onApplySuggestions(s.patch)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
