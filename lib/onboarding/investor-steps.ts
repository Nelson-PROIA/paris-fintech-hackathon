import type { StepConfig } from "./types";
import { COUNTRY_OPTIONS, SMB_SECTOR_OPTIONS } from "./smb-steps";

const INVESTOR_TYPE_OPTIONS = [
  { value: "individual", label: "Particulier" },
  { value: "family_office", label: "Family office" },
  { value: "fund", label: "Fonds" },
  { value: "company", label: "Entreprise / corporate" },
];

const TOTAL_CAPITAL_BUCKETS = [
  { value: 5_000, label: "< 10 k€", rangeKey: "<10k" },
  { value: 25_000, label: "10-50 k€", rangeKey: "10-50k" },
  { value: 100_000, label: "50-200 k€", rangeKey: "50-200k" },
  { value: 500_000, label: "200 k€-1 M€", rangeKey: "200k-1M" },
  { value: 2_500_000, label: "1-5 M€", rangeKey: "1-5M" },
  { value: 7_500_000, label: "> 5 M€", rangeKey: ">5M" },
];

const POSITIONS_OPTIONS = [
  { value: "5", label: "≤ 5 positions" },
  { value: "10", label: "~10 positions" },
  { value: "20", label: "~20 positions" },
  { value: "50", label: "50+ positions" },
];

const RISK_OPTIONS = [
  { value: "low", label: "Faible", hint: "Cash-flow stables, collatéral solide" },
  { value: "medium", label: "Modéré", hint: "Mix défensif + opportuniste" },
  { value: "high", label: "Élevé", hint: "Rendement avant tout, j'accepte la perte" },
];

const YIELD_BUCKETS = [
  { value: 4, label: "3-5 %", rangeKey: "3-5" },
  { value: 6.5, label: "5-8 %", rangeKey: "5-8" },
  { value: 10, label: "8-12 %", rangeKey: "8-12" },
  { value: 16, label: "12-20 %", rangeKey: "12-20" },
  { value: 25, label: "20 %+", rangeKey: ">20" },
];

const HORIZON_OPTIONS = [
  { value: "short_strict", label: "Court terme strict (≤ 90 j)" },
  { value: "mixed", label: "Mixte (court + 6 mois)" },
  { value: "include_long", label: "Inclure 6 mois et plus" },
];

const KYC_CATEGORIES = [
  { value: "id_proof", label: "Pièce d'identité" },
  { value: "address_proof", label: "Justificatif de domicile" },
  { value: "track_record", label: "Track record (optionnel)" },
  { value: "mandate", label: "Mandat de gestion (optionnel)" },
  { value: "other", label: "Autre" },
];

export const INVESTOR_STEPS: StepConfig[] = [
  {
    id: "profile",
    title: "Ton profil d'investisseur",
    subtitle: "Trois infos rapides pour te connaître.",
    fields: [
      {
        id: "investor_type",
        kind: "chips",
        label: "Tu investis en tant que…",
        options: INVESTOR_TYPE_OPTIONS,
        required: true,
      },
      {
        id: "country",
        kind: "chips",
        label: "Pays de résidence (fiscale)",
        options: COUNTRY_OPTIONS,
        required: true,
      },
      {
        id: "wallet_address",
        kind: "text-short",
        label: "Adresse wallet stablecoin (optionnel)",
        helper:
          "Pour la suite : nous y enverrons les positions. Tu peux la lier plus tard.",
        placeholder: "0x… ou adresse compatible USDC",
      },
    ],
  },

  {
    id: "capital",
    title: "Capital alloué et tickets",
    subtitle:
      "On utilise ces montants pour calibrer les opportunités qu'on te montre.",
    visibleIf: (d) => Boolean(d.investor_type),
    fields: [
      {
        id: "total_capital_bucket",
        kind: "buckets",
        label: "Capital total alloué à cette stratégie",
        options: TOTAL_CAPITAL_BUCKETS,
        required: true,
      },
      {
        id: "ticket_range",
        kind: "range-slider",
        label: "Ticket par opération",
        helper: "Min et max — on filtrera les deals en dehors de cette fourchette.",
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
        label: "Diversification cible",
        helper: "Combien de positions tu vises en parallèle ?",
        options: POSITIONS_OPTIONS,
      },
    ],
  },

  {
    id: "risk_yield",
    title: "Profil de risque & rendement",
    subtitle:
      "On joue franc-jeu : ces seuils filtrent les opportunités, mais ne garantissent rien.",
    visibleIf: (d) => Boolean(d.total_capital_bucket),
    fields: [
      {
        id: "risk_tolerance",
        kind: "chips",
        label: "Tolérance au risque",
        options: RISK_OPTIONS,
        required: true,
      },
      {
        id: "target_yield_bucket",
        kind: "buckets",
        label: "Rendement annualisé cible",
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
    title: "Préférences sectorielles & géographiques",
    subtitle: "Tu peux laisser vide pour rester ouvert.",
    visibleIf: (d) => Boolean(d.risk_tolerance),
    fields: [
      {
        id: "sectors_preferred",
        kind: "chips-multi",
        label: "Secteurs préférés",
        options: SMB_SECTOR_OPTIONS,
      },
      {
        id: "countries_preferred",
        kind: "chips-multi",
        label: "Zones géographiques préférées",
        options: COUNTRY_OPTIONS,
      },
      {
        id: "exclusions",
        kind: "text-long-with-llm",
        label: "Exclusions (texte libre)",
        helper:
          "Décris ce que tu refuses de financer (secteurs, géos, types). « Convertir avec l'IA » en extrait des filtres.",
        placeholder:
          "ex. Pas de tabac ni d'alcool, pas de boîtes hors UE, pas de sociétés < 1 an d'existence",
        rows: 3,
        enrichKind: "investor_exclusions",
      },
    ],
  },

  {
    id: "thesis",
    title: "Ta thèse en quelques phrases",
    subtitle:
      "Texte brut → l'IA proposera une version structurée et extraira automatiquement les filtres.",
    visibleIf: (d) => Boolean(d.risk_tolerance),
    fields: [
      {
        id: "thesis_raw",
        kind: "text-long-with-llm",
        label: "Décris ta thèse",
        placeholder:
          "ex. Je cherche du rendement régulier sur des PME françaises rentables, en avance de tréso sur cycle court, faible risque",
        rows: 5,
        enrichKind: "investor_thesis",
        required: true,
      },
    ],
  },

  {
    id: "kyc_documents",
    title: "Documents KYC (optionnel pour démarrer)",
    subtitle:
      "Glisse-dépose ce que tu as. Indispensable avant de financer une première opération réelle.",
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
