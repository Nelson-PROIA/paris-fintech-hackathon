import type { StepConfig } from "./types";

/**
 * Stepper configuration for the financing-need form, used when an SMB
 * creates a new campaign on /company/[id]/new-campaign.
 *
 * This is intentionally separated from the SMB onboarding (which only
 * captures the company profile). Each campaign captures one need —
 * the company profile is reused as-is.
 */

const NEED_OPTIONS = [
  { value: "invoice_advance", label: "Invoice factoring" },
  { value: "working_capital", label: "Working capital / cash flow" },
  { value: "stock_purchase", label: "Inventory purchase" },
  { value: "supplier_payment", label: "Supplier payment" },
  { value: "payroll", label: "Payroll" },
  { value: "short_invest", label: "Short-term investment" },
  { value: "other", label: "Other" },
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
];

const URGENCY_OPTIONS = [
  { value: "very_urgent", label: "Very urgent (< 48h)" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "flexible", label: "Flexible" },
];

const NEED_DOCUMENT_CATEGORIES = [
  { value: "invoices", label: "Related invoices" },
  { value: "purchase_orders", label: "Purchase orders" },
  { value: "contracts", label: "Linked customer contracts" },
  { value: "supplier_quotes", label: "Supplier quotes" },
  { value: "other", label: "Other supporting document" },
];

export const CAMPAIGN_NEED_STEPS: StepConfig[] = [
  {
    id: "need_type",
    title: "What's the need?",
    subtitle: "You can pick several if the request is mixed.",
    fields: [
      {
        id: "needs",
        kind: "chips-multi",
        label: "Need type",
        options: NEED_OPTIONS,
        required: true,
        min: 1,
      },
    ],
  },

  {
    id: "amount",
    title: "How much and over what period?",
    subtitle:
      "Set the net amount you need and the repayment duration.",
    visibleIf: (d) => {
      const arr = d.needs;
      return Array.isArray(arr) && arr.length > 0;
    },
    fields: [
      {
        id: "amount_eur",
        kind: "slider",
        label: "Desired amount",
        min: 5_000,
        max: 500_000,
        step: 5_000,
        unit: "€",
        required: true,
      },
      {
        id: "duration_days",
        kind: "chips",
        label: "Desired repayment duration",
        options: DURATION_OPTIONS,
        required: true,
      },
    ],
  },

  {
    id: "urgency",
    title: "How fast do you need it?",
    subtitle: "Helps investors react quickly.",
    visibleIf: (d) => Boolean(d.amount_eur) && Boolean(d.duration_days),
    fields: [
      {
        id: "urgency",
        kind: "chips",
        label: "Urgency",
        options: URGENCY_OPTIONS,
        required: true,
      },
    ],
  },

  {
    id: "context",
    title: "Context of the request",
    subtitle:
      "A short description helps investors understand the why. The AI can polish it.",
    visibleIf: (d) => Boolean(d.urgency),
    fields: [
      {
        id: "need_description",
        kind: "text-long-with-llm",
        label: "Briefly describe the need",
        helper:
          "Set the context: business opportunity, unexpected expense, seasonal cash gap, etc.",
        placeholder:
          "e.g. A large order is coming in, we need to fund inventory for 30-day delivery — customer pays in 60 days",
        rows: 4,
        enrichKind: "smb_need_description",
        required: true,
      },
    ],
  },

  {
    id: "documents",
    title: "Specific supporting documents (optional)",
    subtitle:
      "Documents directly tied to THIS request (related invoices, quotes, contracts). General company documents are already shared via your profile.",
    visibleIf: (d) => Boolean(d.need_description),
    fields: [
      {
        id: "campaign_documents",
        kind: "documents",
        label: "Documents",
        categories: NEED_DOCUMENT_CATEGORIES,
        accept: "application/pdf,image/png,image/jpeg",
        multiple: true,
      },
    ],
  },
];
