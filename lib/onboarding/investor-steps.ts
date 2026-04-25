import type { StepConfig } from "./types";
import { COUNTRY_OPTIONS, SMB_SECTOR_OPTIONS } from "./smb-steps";

const INVESTOR_TYPE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "family_office", label: "Family office" },
  { value: "fund", label: "Fund" },
  { value: "company", label: "Company / corporate" },
];

const TOTAL_CAPITAL_BUCKETS = [
  { value: 5_000, label: "< €10k", rangeKey: "<10k" },
  { value: 25_000, label: "€10-50k", rangeKey: "10-50k" },
  { value: 100_000, label: "€50-200k", rangeKey: "50-200k" },
  { value: 500_000, label: "€200k-1M", rangeKey: "200k-1M" },
  { value: 2_500_000, label: "€1-5M", rangeKey: "1-5M" },
  { value: 7_500_000, label: "> €5M", rangeKey: ">5M" },
];

const POSITIONS_OPTIONS = [
  { value: "5", label: "≤ 5 positions" },
  { value: "10", label: "~10 positions" },
  { value: "20", label: "~20 positions" },
  { value: "50", label: "50+ positions" },
];

const RISK_OPTIONS = [
  { value: "low", label: "Low", hint: "Stable cash flows, solid collateral" },
  { value: "medium", label: "Moderate", hint: "Defensive + opportunistic mix" },
  { value: "high", label: "High", hint: "Yield first, accept potential losses" },
];

const YIELD_BUCKETS = [
  { value: 4, label: "3-5%", rangeKey: "3-5" },
  { value: 6.5, label: "5-8%", rangeKey: "5-8" },
  { value: 10, label: "8-12%", rangeKey: "8-12" },
  { value: 16, label: "12-20%", rangeKey: "12-20" },
  { value: 25, label: "20%+", rangeKey: ">20" },
];

const HORIZON_OPTIONS = [
  { value: "short_strict", label: "Short-term strict (≤ 90d)" },
  { value: "mixed", label: "Mixed (short + 6 months)" },
  { value: "include_long", label: "Include 6 months and beyond" },
];

const KYC_CATEGORIES = [
  { value: "id_proof", label: "ID document" },
  { value: "address_proof", label: "Proof of address" },
  { value: "track_record", label: "Track record (optional)" },
  { value: "mandate", label: "Discretionary mandate (optional)" },
  { value: "other", label: "Other" },
];

export const INVESTOR_STEPS: StepConfig[] = [
  {
    id: "profile",
    title: "Your investor profile",
    subtitle: "Three quick facts to get to know you.",
    fields: [
      {
        id: "investor_type",
        kind: "chips",
        label: "You're investing as…",
        options: INVESTOR_TYPE_OPTIONS,
        required: true,
      },
      {
        id: "country",
        kind: "chips",
        label: "Country of (tax) residence",
        options: COUNTRY_OPTIONS,
        required: true,
      },
      {
        id: "wallet_address",
        kind: "text-short",
        label: "Stablecoin wallet address (optional)",
        helper:
          "For later: we'll send positions there. You can link it any time.",
        placeholder: "0x… or USDC-compatible address",
      },
    ],
  },

  {
    id: "capital",
    title: "Capital allocated and tickets",
    subtitle:
      "We use these amounts to calibrate the opportunities we show you.",
    visibleIf: (d) => Boolean(d.investor_type),
    fields: [
      {
        id: "total_capital_bucket",
        kind: "buckets",
        label: "Total capital allocated to this strategy",
        options: TOTAL_CAPITAL_BUCKETS,
        required: true,
      },
      {
        id: "ticket_range",
        kind: "range-slider",
        label: "Ticket per deal",
        helper: "Min and max — we'll filter out deals outside this range.",
        min: 500,
        max: 250_000,
        step: 500,
        unit: "€",
        minId: "ticket_min_eur",
        maxId: "ticket_max_eur",
        required: true,
      },
      {
        id: "target_positions",
        kind: "chips",
        label: "Target diversification",
        helper: "How many positions do you want to hold in parallel?",
        options: POSITIONS_OPTIONS,
      },
    ],
  },

  {
    id: "risk_yield",
    title: "Risk and yield profile",
    subtitle:
      "Straight talk: these thresholds filter opportunities but guarantee nothing.",
    visibleIf: (d) => Boolean(d.total_capital_bucket),
    fields: [
      {
        id: "risk_tolerance",
        kind: "chips",
        label: "Risk tolerance",
        options: RISK_OPTIONS,
        required: true,
      },
      {
        id: "target_yield_bucket",
        kind: "buckets",
        label: "Target annualised yield",
        options: YIELD_BUCKETS,
        required: true,
      },
      {
        id: "horizon",
        kind: "chips",
        label: "Horizon",
        options: HORIZON_OPTIONS,
        required: true,
      },
    ],
  },

  {
    id: "preferences",
    title: "Sector and geographic preferences",
    subtitle: "Leave blank to stay open.",
    visibleIf: (d) => Boolean(d.risk_tolerance),
    fields: [
      {
        id: "sectors_preferred",
        kind: "chips-multi",
        label: "Preferred sectors",
        options: SMB_SECTOR_OPTIONS,
      },
      {
        id: "countries_preferred",
        kind: "chips-multi",
        label: "Preferred geographies",
        options: COUNTRY_OPTIONS,
      },
      {
        id: "exclusions",
        kind: "text-long-with-llm",
        label: "Exclusions (free text)",
        helper:
          "Describe what you won't fund (sectors, geos, types). 'Enrich with AI' extracts filters.",
        placeholder:
          "e.g. No tobacco or alcohol, no companies outside the EU, no companies under 1 year old",
        rows: 3,
        enrichKind: "investor_exclusions",
      },
    ],
  },

  {
    id: "thesis",
    title: "Your thesis in a few sentences",
    subtitle:
      "Plain text → the AI will propose a structured version and automatically extract filters.",
    visibleIf: (d) => Boolean(d.risk_tolerance),
    fields: [
      {
        id: "thesis_raw",
        kind: "text-long-with-llm",
        label: "Describe your thesis",
        placeholder:
          "e.g. I look for steady yield from profitable French SMBs, short-cycle invoice factoring, low risk",
        rows: 5,
        enrichKind: "investor_thesis",
        required: true,
      },
    ],
  },

  {
    id: "kyc_documents",
    title: "KYC documents (optional to start)",
    subtitle:
      "Drag and drop what you have. Required before funding your first real deal.",
    visibleIf: (d) => Boolean(d.thesis_raw),
    fields: [
      {
        id: "documents",
        kind: "documents",
        label: "Documents",
        categories: KYC_CATEGORIES,
        accept: "application/pdf,image/png,image/jpeg",
        multiple: true,
      },
    ],
  },
];
