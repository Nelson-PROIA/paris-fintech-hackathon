"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  EnrichmentResult,
  EnrichmentStatus,
  FieldConfig,
  ProfileData,
  ProfileType,
  StepConfig,
} from "@/lib/onboarding/types";
import { StepCard } from "./StepCard";
import { PresetChips } from "./PresetChips";
import { BucketPicker } from "./BucketPicker";
import { MessageInputWithAI } from "./MessageInputWithAI";
import { DocumentDropZone, type UploadedDocument } from "./DocumentDropZone";
import { EnrichmentBanner } from "./EnrichmentBanner";
import { Recap } from "./Recap";

/**
 * Two modes:
 *  - "profile" (default): wired to /api/onboarding/profile (autosave) +
 *    /api/onboarding/finalize (submit). Used by /onboard SMB & investor.
 *    Shows the SIRENE+Tavily enrichment banner for SMBs.
 *  - "campaign": no autosave (drafts are short), no enrichment, submit
 *    handled by `onCampaignSubmit` (which posts to /api/campaigns/create
 *    and returns the redirect path).
 */
export type FlowMode =
  | {
      kind: "profile";
      profileType: ProfileType;
      initialEnrichment: EnrichmentResult | null;
      initialEnrichmentStatus: EnrichmentStatus;
    }
  | {
      kind: "campaign";
      profileType: ProfileType; // still drives DocumentDropZone styling
      onSubmit: (
        data: ProfileData,
        documents: UploadedDocument[]
      ) => Promise<{ redirect: string }>;
      submitLabels?: { saving?: string; creating?: string; submitButton?: string };
    };

type Props = {
  steps: StepConfig[];
  initialData: ProfileData;
  initialDocuments: UploadedDocument[];
  mode: FlowMode;
};

const AUTOSAVE_DEBOUNCE_MS = 600;
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_DURATION_MS = 60_000;

export function OnboardingFlow({
  steps,
  initialData,
  initialDocuments,
  mode,
}: Props) {
  const router = useRouter();
  const profileType = mode.profileType;
  const isProfileMode = mode.kind === "profile";

  const [data, setData] = useState<ProfileData>(initialData);
  const [documents, setDocuments] =
    useState<UploadedDocument[]>(initialDocuments);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentResult | null>(
    mode.kind === "profile" ? mode.initialEnrichment : null
  );
  const [enrichmentStatus, setEnrichmentStatus] = useState<EnrichmentStatus>(
    mode.kind === "profile" ? mode.initialEnrichmentStatus : "idle"
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<
    "idle" | "saving" | "creating" | "redirecting"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Autosave (debounced) ────────────────────────────────────────────────
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshot = useRef<string>(JSON.stringify(initialData));

  const scheduleAutosave = useCallback(
    (next: ProfileData) => {
      // Autosave only makes sense for the profile mode — campaign drafts
      // are short-lived and live in component memory.
      if (!isProfileMode) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(async () => {
        const snapshot = JSON.stringify(next);
        if (snapshot === lastSavedSnapshot.current) return;
        try {
          await fetch("/api/onboarding/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profileType, patch: next }),
          });
          lastSavedSnapshot.current = snapshot;
        } catch {
          // Silent for now — next autosave will retry.
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [isProfileMode, profileType]
  );

  function patch(values: Partial<ProfileData>) {
    setData((prev) => {
      const next = { ...prev, ...values };
      scheduleAutosave(next);
      return next;
    });
  }

  // ── Enrichment polling (only when status is running) ────────────────────
  useEffect(() => {
    if (!isProfileMode) return;
    if (profileType !== "smb") return;
    if (enrichmentStatus !== "running") return;
    const startedAt = Date.now();
    const tick = setInterval(async () => {
      if (Date.now() - startedAt > POLL_MAX_DURATION_MS) {
        clearInterval(tick);
        return;
      }
      try {
        const res = await fetch(
          `/api/onboarding/profile?profileType=${profileType}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const body = await res.json();
        setEnrichmentStatus(body.enrichment_status);
        if (body.enrichment_json) {
          setEnrichment(body.enrichment_json as EnrichmentResult);
        }
        if (
          body.enrichment_status === "done" ||
          body.enrichment_status === "error"
        ) {
          clearInterval(tick);
        }
      } catch {
        // ignore transient fetch errors
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(tick);
  }, [enrichmentStatus, isProfileMode, profileType]);

  // ── Step state machine ──────────────────────────────────────────────────
  const visibleSteps = useMemo(
    () => steps.filter((s) => !s.visibleIf || s.visibleIf(data)),
    [steps, data]
  );

  function isStepComplete(step: StepConfig): boolean {
    return step.fields.every((f) => isFieldComplete(f, data, documents));
  }

  // The active step is the first visible step that is NOT complete, OR the
  // step the user explicitly clicked "Modifier" on.
  const activeStepId =
    editingStepId ??
    visibleSteps.find((s) => !isStepComplete(s))?.id ??
    null;

  const allStepsComplete =
    visibleSteps.length > 0 && visibleSteps.every(isStepComplete);

  // Render order: stop AFTER the active step if any. If everything is done,
  // render every step plus the recap.
  const renderedSteps = useMemo(() => {
    if (!activeStepId) return visibleSteps;
    const idx = visibleSteps.findIndex((s) => s.id === activeStepId);
    return idx === -1 ? visibleSteps : visibleSteps.slice(0, idx + 1);
  }, [visibleSteps, activeStepId]);

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }

    try {
      if (mode.kind === "profile") {
        setSubmitStage("saving");
        const saveRes = await fetch("/api/onboarding/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileType, patch: data }),
        });
        if (!saveRes.ok) {
          const body = await safeJson(saveRes);
          throw new Error(body?.error || `Sauvegarde KO (HTTP ${saveRes.status})`);
        }

        setSubmitStage("creating");
        const res = await fetch("/api/onboarding/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileType }),
        });
        const body = await safeJson(res);
        if (!res.ok) {
          throw new Error(body?.error || `Finalisation KO (HTTP ${res.status})`);
        }

        setSubmitStage("redirecting");
        router.replace(profileType === "smb" ? "/dashboard" : "/feed");
      } else {
        setSubmitStage("creating");
        const { redirect } = await mode.onSubmit(data, documents);
        setSubmitStage("redirecting");
        router.replace(redirect);
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
      setSubmitStage("idle");
    }
  }

  const submitLabels =
    mode.kind === "campaign" ? mode.submitLabels : undefined;

  return (
    <div className="space-y-5">
      {isProfileMode && profileType === "smb" && (
        <EnrichmentBanner
          status={enrichmentStatus}
          result={enrichment}
          onApplySuggestions={(p) => patch(p)}
        />
      )}

      {renderedSteps.map((step, i) => {
        const state =
          step.id === activeStepId
            ? "active"
            : isStepComplete(step)
              ? "done"
              : "pending";
        return (
          <StepCard
            key={step.id}
            index={i}
            total={visibleSteps.length}
            title={step.title}
            subtitle={step.subtitle}
            state={state}
            onEdit={() => setEditingStepId(step.id)}
          >
            {step.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                data={data}
                documents={documents}
                profileType={profileType}
                onChangeValue={(id, value) => patch({ [id]: value })}
                onChangeDocuments={(next) => setDocuments(next)}
                onChangeRange={(minId, maxId, min, max) =>
                  patch({ [minId]: min, [maxId]: max })
                }
              />
            ))}
            {state === "active" && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Tes réponses sont sauvegardées au fur et à mesure.
                </p>
                {isStepComplete(step) && (
                  <button
                    type="button"
                    onClick={() => setEditingStepId(null)}
                    className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Continuer
                  </button>
                )}
              </div>
            )}
          </StepCard>
        );
      })}

      {allStepsComplete && (
        <Recap
          steps={visibleSteps}
          data={data}
          documents={documents}
          enrichment={enrichment}
          profileType={profileType}
          onEditStep={(id) => setEditingStepId(id)}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitStage={submitStage}
          submitError={submitError}
          submitButtonLabel={submitLabels?.submitButton}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field renderer
// ─────────────────────────────────────────────────────────────────────────────

type FieldRendererProps = {
  field: FieldConfig;
  data: ProfileData;
  documents: UploadedDocument[];
  profileType: ProfileType;
  onChangeValue: (id: string, value: unknown) => void;
  onChangeDocuments: (next: UploadedDocument[]) => void;
  onChangeRange: (
    minId: string,
    maxId: string,
    min: number,
    max: number
  ) => void;
};

function FieldRenderer({
  field,
  data,
  documents,
  profileType,
  onChangeValue,
  onChangeDocuments,
  onChangeRange,
}: FieldRendererProps) {
  if (field.visibleIf && !field.visibleIf(data)) return null;

  const labelEl = (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && (
          <span className="ml-1 text-destructive">*</span>
        )}
      </label>
      {field.helper && (
        <p className="text-xs text-muted-foreground">{field.helper}</p>
      )}
    </div>
  );

  let control: React.ReactNode = null;

  switch (field.kind) {
    case "chips":
      control = (
        <PresetChips
          mode="single"
          options={field.options}
          allowOther={field.allowOther}
          value={data[field.id] as string | null | undefined}
          onChange={(next) => onChangeValue(field.id, next)}
        />
      );
      break;

    case "chips-multi":
      control = (
        <PresetChips
          mode="multi"
          options={field.options}
          allowOther={field.allowOther}
          value={data[field.id] as string[] | null | undefined}
          onChange={(next) => onChangeValue(field.id, next)}
        />
      );
      break;

    case "buckets":
      control = (
        <BucketPicker
          options={field.options}
          value={data[field.id] as number | null | undefined}
          onChange={(next) => onChangeValue(field.id, next)}
        />
      );
      break;

    case "text-short":
      control = (
        <input
          type="text"
          value={(data[field.id] as string) ?? ""}
          onChange={(e) => onChangeValue(field.id, e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      );
      break;

    case "text-long":
      control = (
        <textarea
          value={(data[field.id] as string) ?? ""}
          onChange={(e) => onChangeValue(field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 4}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      );
      break;

    case "text-long-with-llm":
      control = (
        <MessageInputWithAI
          value={(data[field.id] as string) ?? ""}
          onChange={(next) => onChangeValue(field.id, next)}
          enrichKind={field.enrichKind}
          context={data}
          placeholder={field.placeholder}
          rows={field.rows}
          onExtract={(extracted) => {
            // For investor thesis/exclusions, surface extracted filters into
            // the structured fields when we don't have user-confirmed values.
            if (!extracted) return;
            const patch: Record<string, unknown> = {};
            if (
              extracted.sectors?.length &&
              field.id === "thesis_raw" &&
              !(data.sectors_preferred as string[] | undefined)?.length
            ) {
              patch.sectors_preferred = extracted.sectors;
            }
            if (
              extracted.countries?.length &&
              field.id === "thesis_raw" &&
              !(data.countries_preferred as string[] | undefined)?.length
            ) {
              patch.countries_preferred = extracted.countries;
            }
            for (const [k, v] of Object.entries(patch)) {
              onChangeValue(k, v);
            }
          }}
        />
      );
      break;

    case "slider":
      control = (
        <SliderControl
          value={(data[field.id] as number | null | undefined) ?? null}
          min={field.min}
          max={field.max}
          step={field.step}
          unit={field.unit}
          onChange={(v) => onChangeValue(field.id, v)}
        />
      );
      break;

    case "range-slider": {
      const minVal =
        (data[field.minId] as number | null | undefined) ?? field.min;
      const maxVal =
        (data[field.maxId] as number | null | undefined) ?? field.max;
      control = (
        <RangeSliderControl
          min={field.min}
          max={field.max}
          step={field.step}
          unit={field.unit}
          minValue={minVal}
          maxValue={maxVal}
          onChange={(lo, hi) => onChangeRange(field.minId, field.maxId, lo, hi)}
        />
      );
      break;
    }

    case "documents":
      control = (
        <DocumentDropZone
          profileType={profileType}
          categories={field.categories}
          documents={documents}
          onChange={onChangeDocuments}
          accept={field.accept}
          multiple={field.multiple}
        />
      );
      break;

    case "yes-no":
      control = (
        <div className="flex gap-2">
          {(["yes", "no"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() =>
                onChangeValue(field.id, data[field.id] === v ? null : v)
              }
              className={
                data[field.id] === v
                  ? "rounded-md border border-foreground bg-foreground px-4 py-1.5 text-sm text-background"
                  : "rounded-md border border-border bg-background px-4 py-1.5 text-sm hover:bg-accent"
              }
            >
              {v === "yes" ? "Oui" : "Non"}
            </button>
          ))}
        </div>
      );
      break;
  }

  return (
    <div className="space-y-2">
      {labelEl}
      {control}
    </div>
  );
}

function SliderControl({
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  value: number | null;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const current = value ?? min;
  return (
    <div className="space-y-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-foreground"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatNumber(min)} {unit}
        </span>
        <span className="text-sm font-semibold text-foreground">
          {formatNumber(current)} {unit}
        </span>
        <span>
          {formatNumber(max)} {unit}
        </span>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm"
      />
    </div>
  );
}

function RangeSliderControl({
  min,
  max,
  step,
  unit,
  minValue,
  maxValue,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  unit?: string;
  minValue: number;
  maxValue: number;
  onChange: (lo: number, hi: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Min {unit}</span>
          <input
            type="number"
            min={min}
            max={maxValue}
            step={step}
            value={minValue}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange(v, Math.max(v, maxValue));
            }}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Max {unit}</span>
          <input
            type="number"
            min={minValue}
            max={max}
            step={step}
            value={maxValue}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange(Math.min(minValue, v), v);
            }}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Plage actuelle : {formatNumber(minValue)} – {formatNumber(maxValue)}{" "}
        {unit}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<{ error?: string } | null> {
  try {
    return (await res.json()) as { error?: string };
  } catch {
    return null;
  }
}

function isFieldComplete(
  field: FieldConfig,
  data: ProfileData,
  documents: UploadedDocument[]
): boolean {
  if (field.visibleIf && !field.visibleIf(data)) return true;
  if (!field.required) return true;

  if (field.kind === "documents") {
    return documents.length > 0;
  }
  if (field.kind === "chips-multi") {
    const v = data[field.id];
    if (!Array.isArray(v)) return false;
    if (field.min != null && v.length < field.min) return false;
    return v.length > 0;
  }
  if (field.kind === "range-slider") {
    return (
      typeof data[field.minId] === "number" &&
      typeof data[field.maxId] === "number"
    );
  }
  const v = data[field.id];
  if (v == null) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000)
    return new Intl.NumberFormat("fr-FR").format(n);
  return String(n);
}
