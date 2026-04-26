"use client";

import type {
  ProfileData,
  ProfileType,
  StepConfig,
  EnrichmentResult,
} from "@/lib/onboarding/types";
import type { UploadedDocument } from "./DocumentDropZone";

type Props = {
  steps: StepConfig[];
  data: ProfileData;
  documents: UploadedDocument[];
  enrichment: EnrichmentResult | null;
  profileType: ProfileType;
  onEditStep: (stepId: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitStage: "idle" | "saving" | "creating" | "redirecting";
  submitError: string | null;
  submitButtonLabel?: string;
};

const STAGE_LABEL: Record<Props["submitStage"], string> = {
  idle: "Submit",
  saving: "Saving…",
  creating: "Creating company…",
  redirecting: "Redirecting…",
};

export function Recap({
  steps,
  data,
  documents,
  enrichment,
  profileType,
  onEditStep,
  onSubmit,
  submitting,
  submitStage,
  submitError,
  submitButtonLabel,
}: Props) {
  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-6">
      <header>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Summary
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">
          Almost there. Review and submit.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything is editable after submission. Range fields are stored as
          the median value for matching calculations.
        </p>
      </header>

      <div className="space-y-3">
        {steps.map((step) => {
          if (step.visibleIf && !step.visibleIf(data)) return null;
          return (
            <div
              key={step.id}
              className="rounded-lg border border-border bg-card p-3.5 transition hover:border-foreground/30"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-[-0.01em]">
                  {step.title}
                </h3>
                <button
                  type="button"
                  onClick={() => onEditStep(step.id)}
                  className="rounded border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                >
                  edit
                </button>
              </div>
              <dl className="mt-2 space-y-1.5 text-xs">
                {step.fields.map((field) => {
                  if (field.visibleIf && !field.visibleIf(data)) return null;
                  if (field.kind === "documents") {
                    return (
                      <div key={field.id}>
                        <dt className="text-muted-foreground">{field.label}</dt>
                        <dd className="mt-0.5">
                          {documents.length === 0 ? (
                            <span className="text-muted-foreground">
                              none
                            </span>
                          ) : (
                            <ul className="space-y-0.5">
                              {documents.map((d) => (
                                <li key={d.id}>
                                  • {d.filename}
                                  {d.category && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      ({d.category})
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </dd>
                      </div>
                    );
                  }
                  if (field.kind === "range-slider") {
                    const min = data[field.minId];
                    const max = data[field.maxId];
                    return (
                      <div key={field.id} className="flex gap-2">
                        <dt className="text-muted-foreground">{field.label}:</dt>
                        <dd className="font-medium">
                          {min != null && max != null
                            ? `${formatNumber(min as number)} – ${formatNumber(max as number)} ${field.unit ?? ""}`
                            : "—"}
                        </dd>
                      </div>
                    );
                  }
                  const raw = data[field.id];
                  return (
                    <div key={field.id} className="flex gap-2">
                      <dt className="text-muted-foreground">{field.label}:</dt>
                      <dd className="font-medium">
                        {formatValue(raw)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}

        {profileType === "smb" && enrichment && enrichment.source !== "none" && (
          <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs">
            <div className="font-semibold">Enriched profile (background research)</div>
            {enrichment.siren && <div>SIREN: {enrichment.siren}</div>}
            {enrichment.founded_date && (
              <div>Founded: {enrichment.founded_date}</div>
            )}
            {enrichment.principal_activity && (
              <div>INSEE activity: {enrichment.principal_activity}</div>
            )}
            {enrichment.address && <div>Address: {enrichment.address}</div>}
            {enrichment.web_mentions.length > 0 && (
              <div>
                {enrichment.web_mentions.length} archived web mention
                {enrichment.web_mentions.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        )}
      </div>

      {submitError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
        {submitting && submitStage !== "idle" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand" />
            {STAGE_LABEL[submitStage]}
          </span>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            "In progress…"
          ) : (
            <>
              {submitButtonLabel ?? "Submit"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </section>
  );
}

function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000)
    return new Intl.NumberFormat("en-GB").format(n);
  return String(n);
}
