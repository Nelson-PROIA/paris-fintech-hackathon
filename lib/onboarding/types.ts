/**
 * Types partagés du moteur de form en escalier.
 *
 * Chaque step déclare ses champs de manière déclarative. Le composant
 * OnboardingFlow consomme cette config et orchestre la cascade :
 * autosave, conditions de visibilité, validation, et révélation
 * progressive du step suivant.
 */

export type ProfileType = "smb" | "investor";

export type EnrichmentStatus = "idle" | "running" | "done" | "error";

export type ProfileData = Record<string, unknown>;

export type FieldKind =
  | "chips"
  | "chips-multi"
  | "buckets"
  | "text-short"
  | "text-long"
  | "text-long-with-llm"
  | "slider"
  | "range-slider"
  | "documents"
  | "yes-no";

export type ChipOption = {
  /** Stored value (string) */
  value: string;
  /** Human label */
  label: string;
  /** Optional helper line under the chip */
  hint?: string;
};

export type BucketOption = {
  /** Stored value used in finalize mapping (median of the range, in EUR / months / etc.) */
  value: number;
  /** Display label, e.g. "10-50k€" */
  label: string;
  /** Stored alongside for legibility in data_json */
  rangeKey: string;
};

export type FieldBase = {
  /** Stable id, used as key in ProfileData */
  id: string;
  label: string;
  /** Optional helper text below the label */
  helper?: string;
  /** Whether this field is required for the step to count as complete */
  required?: boolean;
  /** Visibility predicate evaluated against the current ProfileData */
  visibleIf?: (data: ProfileData) => boolean;
};

export type ChipsField = FieldBase & {
  kind: "chips";
  options: ChipOption[];
  /** Allow user to write a custom value when none of the chips fit */
  allowOther?: boolean;
};

export type ChipsMultiField = FieldBase & {
  kind: "chips-multi";
  options: ChipOption[];
  allowOther?: boolean;
  min?: number;
  max?: number;
};

export type BucketsField = FieldBase & {
  kind: "buckets";
  options: BucketOption[];
};

export type TextShortField = FieldBase & {
  kind: "text-short";
  placeholder?: string;
  maxLength?: number;
};

export type TextLongField = FieldBase & {
  kind: "text-long";
  placeholder?: string;
  rows?: number;
};

export type TextLongWithLLMField = FieldBase & {
  kind: "text-long-with-llm";
  placeholder?: string;
  rows?: number;
  /** Identifier sent to /api/onboarding/llm-complete to pick the right schema/prompt */
  enrichKind: LLMEnrichKind;
};

export type SliderField = FieldBase & {
  kind: "slider";
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export type RangeSliderField = FieldBase & {
  kind: "range-slider";
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Stores both min and max under these field ids */
  minId: string;
  maxId: string;
};

export type DocumentsField = FieldBase & {
  kind: "documents";
  /** Categories proposed in the dropdown */
  categories: ChipOption[];
  /** Mime types accepted */
  accept?: string;
  multiple?: boolean;
};

export type YesNoField = FieldBase & {
  kind: "yes-no";
};

export type FieldConfig =
  | ChipsField
  | ChipsMultiField
  | BucketsField
  | TextShortField
  | TextLongField
  | TextLongWithLLMField
  | SliderField
  | RangeSliderField
  | DocumentsField
  | YesNoField;

export type StepConfig = {
  id: string;
  title: string;
  subtitle?: string;
  /** If predicate returns false, step is skipped entirely */
  visibleIf?: (data: ProfileData) => boolean;
  fields: FieldConfig[];
};

export type LLMEnrichKind =
  | "smb_activity_description"
  | "smb_need_description"
  | "smb_seasonality_note"
  | "investor_thesis"
  | "investor_exclusions";

/**
 * Result returned by the company enricher (SIRENE + Tavily for now).
 * Stored in onboarding_profiles.enrichment_json.
 */
export type EnrichmentResult = {
  source: "sirene_tavily" | "pappers" | "none";
  legal_name: string | null;
  siren: string | null;
  founded_date: string | null;
  founded_year: number | null;
  principal_activity: string | null;
  address: string | null;
  is_active: boolean | null;
  web_mentions: Array<{
    title: string;
    url: string;
    excerpt: string;
  }>;
  /**
   * Pre-computed suggestions ready to be applied to the form.
   * Only fields the enricher feels confident about.
   */
  suggested_fields: Partial<ProfileData>;
  /** ISO timestamp */
  generated_at: string;
};
