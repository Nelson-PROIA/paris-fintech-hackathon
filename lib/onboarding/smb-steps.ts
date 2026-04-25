import type { StepConfig } from "./types";

export const COUNTRY_OPTIONS = [
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "NL", label: "Netherlands" },
  { value: "BE", label: "Belgium" },
  { value: "PT", label: "Portugal" },
  { value: "OTHER", label: "Other" },
];

/**
 * Sectors stay aligned with the legacy SECTORS enum in lib/ai/onboarding-smb.ts
 * so the finalize mapping into `companies.sector` works without a converter.
 */
export const SMB_SECTOR_OPTIONS = [
  { value: "b2b_services", label: "B2B services" },
  { value: "agency", label: "Agency / consulting" },
  { value: "saas_micro", label: "SaaS / micro-publisher" },
  { value: "makers", label: "Makers / artisans" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "professional_services", label: "Professional services" },
  { value: "ecommerce", label: "E-commerce" },
];

const TEAM_SIZE_BUCKETS = [
  { value: 1, label: "1 (solo)", rangeKey: "1" },
  { value: 3, label: "2-5", rangeKey: "2-5" },
  { value: 8, label: "6-10", rangeKey: "6-10" },
  { value: 18, label: "11-25", rangeKey: "11-25" },
  { value: 38, label: "26-50", rangeKey: "26-50" },
  { value: 75, label: "50+", rangeKey: "50+" },
];

const AGE_BUCKETS = [
  { value: 0, label: "Less than a year", rangeKey: "<1y" },
  { value: 2, label: "1-3 years", rangeKey: "1-3y" },
  { value: 4, label: "3-5 years", rangeKey: "3-5y" },
  { value: 7, label: "5-10 years", rangeKey: "5-10y" },
  { value: 12, label: "More than 10 years", rangeKey: ">10y" },
];

const REVENUE_BUCKETS = [
  { value: 5_000, label: "< €10k/month", rangeKey: "<10k" },
  { value: 30_000, label: "€10-50k/month", rangeKey: "10-50k" },
  { value: 75_000, label: "€50-100k/month", rangeKey: "50-100k" },
  { value: 250_000, label: "€100-500k/month", rangeKey: "100-500k" },
  { value: 750_000, label: "€500k-1M/month", rangeKey: "500k-1M" },
  { value: 1_500_000, label: "> €1M/month", rangeKey: ">1M" },
];

const MARGIN_BUCKETS = [
  { value: 10, label: "< 20%", rangeKey: "<20" },
  { value: 30, label: "20-40%", rangeKey: "20-40" },
  { value: 50, label: "40-60%", rangeKey: "40-60" },
  { value: 70, label: "> 60%", rangeKey: ">60" },
  { value: -1, label: "I don't know", rangeKey: "unknown" },
];

const DSO_BUCKETS = [
  { value: 15, label: "< 30 days", rangeKey: "<30d" },
  { value: 38, label: "30-45 days", rangeKey: "30-45d" },
  { value: 53, label: "45-60 days", rangeKey: "45-60d" },
  { value: 75, label: "60-90 days", rangeKey: "60-90d" },
  { value: 110, label: "> 90 days", rangeKey: ">90d" },
];

const DOCUMENT_CATEGORIES = [
  { value: "kbis", label: "KBIS / company registry" },
  { value: "invoices", label: "Customer invoices" },
  { value: "contracts", label: "Customer contracts" },
  { value: "balance_sheet", label: "Balance sheet / accounts" },
  { value: "bank_statements", label: "Bank statements" },
  { value: "other", label: "Other" },
];

export const SMB_STEPS: StepConfig[] = [
  {
    id: "identity",
    title: "Let's start with the basics",
    subtitle:
      "Legal name and country are enough for us to kick off background research on your company.",
    fields: [
      {
        id: "legal_name",
        kind: "text-short",
        label: "Company legal name",
        placeholder: "e.g. Boulangerie Martin SAS",
        required: true,
        maxLength: 120,
      },
      {
        id: "country",
        kind: "chips",
        label: "Country",
        options: COUNTRY_OPTIONS,
        required: true,
      },
      {
        id: "siret",
        kind: "text-short",
        label: "SIRET (optional)",
        helper:
          "If you have it handy, we'll pull your founding date and principal activity automatically.",
        placeholder: "14 digits",
        visibleIf: (d) => d.country === "FR",
      },
      {
        id: "city",
        kind: "text-short",
        label: "City",
        placeholder: "e.g. Lyon",
      },
    ],
  },

  {
    id: "activity",
    title: "What you actually do",
    subtitle: "Pick a sector, then describe in 1-2 sentences — the AI can polish.",
    visibleIf: (d) => Boolean(d.legal_name) && Boolean(d.country),
    fields: [
      {
        id: "sector",
        kind: "chips",
        label: "Primary sector",
        options: SMB_SECTOR_OPTIONS,
        required: true,
      },
      {
        id: "activity_description",
        kind: "text-long-with-llm",
        label: "Describe your activity in a few words",
        helper:
          "Plain sentence: products/services, customers, sales channel. The 'Enrich' button proposes a polished version.",
        placeholder:
          "e.g. We make small-batch organic cosmetics, sold in our Lyon shop and online",
        rows: 4,
        enrichKind: "smb_activity_description",
        required: true,
      },
      {
        id: "website",
        kind: "text-short",
        label: "Website (optional)",
        placeholder: "https://",
      },
    ],
  },

  {
    id: "size",
    title: "Team size and company age",
    subtitle: "Pick the closest range — no need to be exact.",
    visibleIf: (d) => Boolean(d.sector),
    fields: [
      {
        id: "team_size_bucket",
        kind: "buckets",
        label: "Total headcount",
        options: TEAM_SIZE_BUCKETS,
        required: true,
      },
      {
        id: "age_bucket",
        kind: "buckets",
        label: "Years in business",
        helper: "Pre-filled if we find the founding date via SIRENE.",
        options: AGE_BUCKETS,
        required: true,
      },
    ],
  },

  {
    id: "economics",
    title: "Your business economics",
    subtitle:
      "Ranges only — that's enough for us to suggest the right financing options.",
    visibleIf: (d) => Boolean(d.team_size_bucket),
    fields: [
      {
        id: "monthly_revenue_bucket",
        kind: "buckets",
        label: "Monthly revenue",
        options: REVENUE_BUCKETS,
        required: true,
      },
      {
        id: "gross_margin_bucket",
        kind: "buckets",
        label: "Approximate gross margin",
        options: MARGIN_BUCKETS,
      },
      {
        id: "dso_bucket",
        kind: "buckets",
        label: "Average customer payment delay (DSO)",
        helper:
          "Core to our offer: the longer your customers pay, the more invoice factoring makes sense.",
        options: DSO_BUCKETS,
        required: true,
      },
      {
        id: "seasonality",
        kind: "yes-no",
        label: "Seasonal business?",
      },
      {
        id: "seasonality_note",
        kind: "text-long-with-llm",
        label: "Briefly describe the seasonality",
        helper: "e.g. summer + Christmas peaks, January-February low.",
        rows: 3,
        enrichKind: "smb_seasonality_note",
        visibleIf: (d) => d.seasonality === "yes",
      },
    ],
  },

  {
    id: "documents",
    title: "Supporting documents (optional but recommended)",
    subtitle:
      "Drag and drop your general documents: KBIS, balance sheet, bank statements. They enrich your company profile and will be visible to investors.",
    visibleIf: (d) => Boolean(d.monthly_revenue_bucket),
    fields: [
      {
        id: "documents",
        kind: "documents",
        label: "Documents",
        categories: DOCUMENT_CATEGORIES,
        accept: "application/pdf,image/png,image/jpeg",
        multiple: true,
      },
    ],
  },
];
