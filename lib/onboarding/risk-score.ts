import type { EnrichmentResult } from "./types";

/**
 * Lightweight, transparent short-term risk scoring.
 *
 * Inputs come from `onboarding_profiles.data_json` and `enrichment_json`.
 * Output is a letter grade (A best → D worst) and a list of human-readable
 * reasons that we surface verbatim to the lender. No LLM, no opaque math.
 *
 * This is intentionally crude and conservative — it's a triage signal, not a
 * decision. Future work: integrate financial documents, payment history, etc.
 */

export type RiskGrade = "A" | "B" | "C" | "D";

export type RiskScoreResult = {
  grade: RiskGrade;
  score: number; // 0-100, higher = safer
  reasons: string[];
  flags: string[]; // negative signals worth surfacing
  positives: string[]; // positive signals worth surfacing
};

type Inputs = {
  data: Record<string, unknown>;
  enrichment: EnrichmentResult | null;
};

export function computeRiskScore({ data, enrichment }: Inputs): RiskScoreResult {
  let score = 60; // neutral baseline
  const flags: string[] = [];
  const positives: string[] = [];

  // ── DSO (most important short-term signal) ────────────────────────────────
  const dso = numberOrNull(data.dso_bucket);
  if (dso != null) {
    if (dso < 30) {
      score += 12;
      positives.push("DSO court (< 30 j) — peu de risque de retard de paiement");
    } else if (dso < 45) {
      score += 6;
      positives.push("DSO modéré (30-45 j)");
    } else if (dso < 60) {
      // neutral
    } else if (dso < 90) {
      score -= 8;
      flags.push("DSO élevé (60-90 j) — exposition modérée au cash gap");
    } else {
      score -= 18;
      flags.push("DSO très élevé (> 90 j) — risque de tension de trésorerie");
    }
  }

  // ── Company age (via enrichment first, fallback to bucket) ────────────────
  const ageYears = inferAgeYears(data, enrichment);
  if (ageYears != null) {
    if (ageYears < 1) {
      score -= 15;
      flags.push("Entreprise de moins d'un an — peu d'historique");
    } else if (ageYears < 3) {
      score -= 5;
    } else if (ageYears >= 5 && ageYears < 10) {
      score += 6;
      positives.push(`${Math.round(ageYears)} ans d'ancienneté`);
    } else if (ageYears >= 10) {
      score += 10;
      positives.push(`${Math.round(ageYears)} ans d'ancienneté — track record solide`);
    }
  } else {
    flags.push("Ancienneté inconnue");
  }

  // ── Gross margin ──────────────────────────────────────────────────────────
  const margin = numberOrNull(data.gross_margin_bucket);
  if (margin != null && margin >= 0) {
    if (margin < 20) {
      score -= 8;
      flags.push("Marge brute < 20 % — peu d'amortissement possible");
    } else if (margin < 40) {
      // neutral
    } else if (margin < 60) {
      score += 4;
      positives.push("Marge brute 40-60 %");
    } else {
      score += 8;
      positives.push("Marge brute > 60 % — confortable");
    }
  }

  // ── Revenue level vs requested amount ─────────────────────────────────────
  const monthlyRevenue = numberOrNull(data.monthly_revenue_bucket);
  const askedAmount = numberOrNull(data.amount_eur);
  if (monthlyRevenue != null && askedAmount != null && monthlyRevenue > 0) {
    const monthsOfRevenue = askedAmount / monthlyRevenue;
    if (monthsOfRevenue > 6) {
      score -= 12;
      flags.push(
        `Demande > 6 mois de CA (${monthsOfRevenue.toFixed(1)} mois) — repayment lourd`
      );
    } else if (monthsOfRevenue > 3) {
      score -= 4;
      flags.push(
        `Demande de ${monthsOfRevenue.toFixed(1)} mois de CA — montant significatif`
      );
    } else if (monthsOfRevenue < 1) {
      score += 6;
      positives.push("Demande < 1 mois de CA — facilement absorbable");
    }
  }

  // ── SIRENE status ─────────────────────────────────────────────────────────
  if (enrichment) {
    if (enrichment.is_active === true) {
      score += 8;
      positives.push("Statut SIRENE : active");
    } else if (enrichment.is_active === false) {
      score -= 25;
      flags.push("Statut SIRENE : INACTIVE");
    }
    if (enrichment.siren) {
      positives.push(`SIREN vérifié (${enrichment.siren})`);
    }
  } else {
    flags.push("Aucune vérification SIRENE disponible");
  }

  // ── Urgency (very urgent often = pressure) ────────────────────────────────
  const urgency = stringOrNull(data.urgency);
  if (urgency === "very_urgent") {
    score -= 6;
    flags.push("Demande très urgente (< 48 h) — peu de marge de négociation");
  }

  score = clamp(Math.round(score), 0, 100);

  let grade: RiskGrade;
  if (score >= 75) grade = "A";
  else if (score >= 60) grade = "B";
  else if (score >= 40) grade = "C";
  else grade = "D";

  const reasons = buildReasons(grade, positives, flags);

  return { grade, score, reasons, flags, positives };
}

function buildReasons(
  grade: RiskGrade,
  positives: string[],
  flags: string[]
): string[] {
  const reasons: string[] = [];
  if (grade === "A" || grade === "B") {
    reasons.push(...positives.slice(0, 2));
    if (flags.length > 0) reasons.push(`Vigilance : ${flags[0].toLowerCase()}`);
  } else {
    reasons.push(...flags.slice(0, 2));
    if (positives.length > 0) reasons.push(`Atout : ${positives[0].toLowerCase()}`);
  }
  if (reasons.length === 0)
    reasons.push("Données insuffisantes pour un signal fort");
  return reasons.slice(0, 3);
}

function inferAgeYears(
  data: Record<string, unknown>,
  enrichment: EnrichmentResult | null
): number | null {
  if (enrichment?.founded_year != null) {
    return new Date().getFullYear() - enrichment.founded_year;
  }
  const bucket = numberOrNull(data.age_bucket);
  return bucket;
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function gradeColorClass(grade: RiskGrade): string {
  switch (grade) {
    case "A":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "B":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30";
    case "C":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "D":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  }
}
