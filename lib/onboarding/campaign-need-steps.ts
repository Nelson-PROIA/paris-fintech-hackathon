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
  { value: "invoice_advance", label: "Avance sur factures" },
  { value: "working_capital", label: "BFR / trésorerie" },
  { value: "stock_purchase", label: "Achat de stock" },
  { value: "supplier_payment", label: "Paiement fournisseur" },
  { value: "payroll", label: "Salaires" },
  { value: "short_invest", label: "Investissement court" },
  { value: "other", label: "Autre" },
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 jours" },
  { value: "60", label: "60 jours" },
  { value: "90", label: "90 jours" },
  { value: "180", label: "6 mois" },
];

const URGENCY_OPTIONS = [
  { value: "very_urgent", label: "Très urgent (< 48 h)" },
  { value: "this_week", label: "Cette semaine" },
  { value: "this_month", label: "Ce mois" },
  { value: "flexible", label: "Flexible" },
];

const NEED_DOCUMENT_CATEGORIES = [
  { value: "invoices", label: "Factures concernées" },
  { value: "purchase_orders", label: "Bons de commande" },
  { value: "contracts", label: "Contrats clients liés" },
  { value: "supplier_quotes", label: "Devis fournisseurs" },
  { value: "other", label: "Autre justificatif" },
];

export const CAMPAIGN_NEED_STEPS: StepConfig[] = [
  {
    id: "need_type",
    title: "Quel est le besoin ?",
    subtitle: "Tu peux en sélectionner plusieurs si la demande est mixte.",
    fields: [
      {
        id: "needs",
        kind: "chips-multi",
        label: "Type de besoin",
        options: NEED_OPTIONS,
        required: true,
        min: 1,
      },
    ],
  },

  {
    id: "amount",
    title: "Combien et sur combien de temps ?",
    subtitle:
      "Indique le montant net dont tu as besoin et la durée sur laquelle tu rembourseras.",
    visibleIf: (d) => {
      const arr = d.needs;
      return Array.isArray(arr) && arr.length > 0;
    },
    fields: [
      {
        id: "amount_eur",
        kind: "slider",
        label: "Montant souhaité",
        min: 5_000,
        max: 500_000,
        step: 5_000,
        unit: "€",
        required: true,
      },
      {
        id: "duration_days",
        kind: "chips",
        label: "Durée de remboursement souhaitée",
        options: DURATION_OPTIONS,
        required: true,
      },
    ],
  },

  {
    id: "urgency",
    title: "À quelle vitesse en as-tu besoin ?",
    subtitle: "Cela aide les prêteurs à se positionner rapidement.",
    visibleIf: (d) => Boolean(d.amount_eur) && Boolean(d.duration_days),
    fields: [
      {
        id: "urgency",
        kind: "chips",
        label: "Urgence",
        options: URGENCY_OPTIONS,
        required: true,
      },
    ],
  },

  {
    id: "context",
    title: "Le contexte de la demande",
    subtitle:
      "Une description courte permet aux prêteurs de comprendre le pourquoi. L'IA peut polir.",
    visibleIf: (d) => Boolean(d.urgency),
    fields: [
      {
        id: "need_description",
        kind: "text-long-with-llm",
        label: "Explique brièvement le besoin",
        helper:
          "Pose le contexte : opportunité commerciale, dépense imprévue, cash gap saisonnier, etc.",
        placeholder:
          "ex. Une grosse commande arrive, on doit avancer le stock pour livraison sous 30 jours — payé à 60 j par le client",
        rows: 4,
        enrichKind: "smb_need_description",
        required: true,
      },
    ],
  },

  {
    id: "documents",
    title: "Justificatifs spécifiques (optionnel)",
    subtitle:
      "Documents directement liés à CETTE demande (factures concernées, devis, contrat). Les documents généraux de l'entreprise sont déjà partagés via ton profil.",
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
