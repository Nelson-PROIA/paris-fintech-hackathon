import type { StepConfig } from "./types";

export const COUNTRY_OPTIONS = [
  { value: "FR", label: "France" },
  { value: "DE", label: "Allemagne" },
  { value: "ES", label: "Espagne" },
  { value: "IT", label: "Italie" },
  { value: "NL", label: "Pays-Bas" },
  { value: "BE", label: "Belgique" },
  { value: "PT", label: "Portugal" },
  { value: "OTHER", label: "Autre" },
];

/**
 * Sectors stay aligned with the legacy SECTORS enum in lib/ai/onboarding-smb.ts
 * so the finalize mapping into `companies.sector` works without a converter.
 */
export const SMB_SECTOR_OPTIONS = [
  { value: "b2b_services", label: "Services B2B" },
  { value: "agency", label: "Agence / conseil" },
  { value: "saas_micro", label: "SaaS / micro-éditeur" },
  { value: "makers", label: "Artisanat / makers" },
  { value: "retail", label: "Commerce / retail" },
  { value: "manufacturing", label: "Industrie / fabrication" },
  { value: "professional_services", label: "Services professionnels" },
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
  { value: 0, label: "Moins d'un an", rangeKey: "<1y" },
  { value: 2, label: "1-3 ans", rangeKey: "1-3y" },
  { value: 4, label: "3-5 ans", rangeKey: "3-5y" },
  { value: 7, label: "5-10 ans", rangeKey: "5-10y" },
  { value: 12, label: "Plus de 10 ans", rangeKey: ">10y" },
];

const REVENUE_BUCKETS = [
  { value: 5_000, label: "< 10 k€/mois", rangeKey: "<10k" },
  { value: 30_000, label: "10-50 k€/mois", rangeKey: "10-50k" },
  { value: 75_000, label: "50-100 k€/mois", rangeKey: "50-100k" },
  { value: 250_000, label: "100-500 k€/mois", rangeKey: "100-500k" },
  { value: 750_000, label: "500 k€-1 M€/mois", rangeKey: "500k-1M" },
  { value: 1_500_000, label: "> 1 M€/mois", rangeKey: ">1M" },
];

const MARGIN_BUCKETS = [
  { value: 10, label: "< 20 %", rangeKey: "<20" },
  { value: 30, label: "20-40 %", rangeKey: "20-40" },
  { value: 50, label: "40-60 %", rangeKey: "40-60" },
  { value: 70, label: "> 60 %", rangeKey: ">60" },
  { value: -1, label: "Je ne sais pas", rangeKey: "unknown" },
];

const DSO_BUCKETS = [
  { value: 15, label: "< 30 jours", rangeKey: "<30d" },
  { value: 38, label: "30-45 jours", rangeKey: "30-45d" },
  { value: 53, label: "45-60 jours", rangeKey: "45-60d" },
  { value: 75, label: "60-90 jours", rangeKey: "60-90d" },
  { value: 110, label: "> 90 jours", rangeKey: ">90d" },
];

const DOCUMENT_CATEGORIES = [
  { value: "kbis", label: "KBIS / extrait registre" },
  { value: "invoices", label: "Factures clients" },
  { value: "contracts", label: "Contrats clients" },
  { value: "balance_sheet", label: "Bilan / liasse" },
  { value: "bank_statements", label: "Relevés bancaires" },
  { value: "other", label: "Autre" },
];

export const SMB_STEPS: StepConfig[] = [
  {
    id: "identity",
    title: "On commence par les bases",
    subtitle:
      "Le nom légal et le pays nous suffisent pour lancer une recherche en arrière-plan sur ta boîte.",
    fields: [
      {
        id: "legal_name",
        kind: "text-short",
        label: "Nom légal de l'entreprise",
        placeholder: "ex. Boulangerie Martin SAS",
        required: true,
        maxLength: 120,
      },
      {
        id: "country",
        kind: "chips",
        label: "Pays",
        options: COUNTRY_OPTIONS,
        required: true,
      },
      {
        id: "siret",
        kind: "text-short",
        label: "SIRET (optionnel)",
        helper:
          "Si tu l'as sous la main, on récupère ton ancienneté et ton activité automatiquement.",
        placeholder: "14 chiffres",
        visibleIf: (d) => d.country === "FR",
      },
      {
        id: "city",
        kind: "text-short",
        label: "Ville",
        placeholder: "ex. Lyon",
      },
    ],
  },

  {
    id: "activity",
    title: "Ce que tu fais concrètement",
    subtitle: "Pose un secteur, puis raconte en 1-2 phrases — l'IA peut polir.",
    visibleIf: (d) => Boolean(d.legal_name) && Boolean(d.country),
    fields: [
      {
        id: "sector",
        kind: "chips",
        label: "Secteur principal",
        options: SMB_SECTOR_OPTIONS,
        required: true,
      },
      {
        id: "activity_description",
        kind: "text-long-with-llm",
        label: "Décris ton activité en quelques mots",
        helper:
          "Phrase brute : produits/services, clientèle, canal de vente. Le bouton « Enrichir » propose une version pitchée.",
        placeholder:
          "ex. On fabrique des cosmétiques bio en petite série, vendus en boutique à Lyon et sur notre site",
        rows: 4,
        enrichKind: "smb_activity_description",
        required: true,
      },
      {
        id: "website",
        kind: "text-short",
        label: "Site web (optionnel)",
        placeholder: "https://",
      },
    ],
  },

  {
    id: "size",
    title: "La taille de l'équipe et l'âge",
    subtitle: "Choisis la tranche la plus proche — pas besoin d'être au chiffre près.",
    visibleIf: (d) => Boolean(d.sector),
    fields: [
      {
        id: "team_size_bucket",
        kind: "buckets",
        label: "Effectif total",
        options: TEAM_SIZE_BUCKETS,
        required: true,
      },
      {
        id: "age_bucket",
        kind: "buckets",
        label: "Âge de la boîte",
        helper: "Pré-rempli si on trouve la date de création via SIRENE.",
        options: AGE_BUCKETS,
        required: true,
      },
    ],
  },

  {
    id: "economics",
    title: "L'économie de la boîte",
    subtitle:
      "Tranches uniquement — c'est ce qui nous permet de proposer les bons financements.",
    visibleIf: (d) => Boolean(d.team_size_bucket),
    fields: [
      {
        id: "monthly_revenue_bucket",
        kind: "buckets",
        label: "Chiffre d'affaires mensuel",
        options: REVENUE_BUCKETS,
        required: true,
      },
      {
        id: "gross_margin_bucket",
        kind: "buckets",
        label: "Marge brute approximative",
        options: MARGIN_BUCKETS,
      },
      {
        id: "dso_bucket",
        kind: "buckets",
        label: "Délai moyen de paiement de tes clients (DSO)",
        helper:
          "Au cœur de notre offre : plus tes clients paient tard, plus l'avance sur facture a du sens.",
        options: DSO_BUCKETS,
        required: true,
      },
      {
        id: "seasonality",
        kind: "yes-no",
        label: "Activité saisonnière ?",
      },
      {
        id: "seasonality_note",
        kind: "text-long-with-llm",
        label: "Décris brièvement la saisonnalité",
        helper: "Ex. pics été + Noël, creux janvier-février.",
        rows: 3,
        enrichKind: "smb_seasonality_note",
        visibleIf: (d) => d.seasonality === "yes",
      },
    ],
  },

  {
    id: "documents",
    title: "Justificatifs (optionnel mais recommandé)",
    subtitle:
      "Glisse-dépose tes documents généraux : KBIS, bilan, relevés. Ils enrichissent ton profil entreprise et seront accessibles aux prêteurs.",
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
