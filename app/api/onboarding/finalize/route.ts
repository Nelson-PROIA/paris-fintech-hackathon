import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  createCompany,
  getInvestorByUserId,
  getOnboardingProfile,
  getOrCreateInvestor,
  markOnboardingSubmitted,
  updateInvestorThesis,
  type OnboardingType,
} from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_SECTORS = new Set([
  "b2b_services",
  "agency",
  "saas_micro",
  "makers",
  "retail",
  "manufacturing",
  "professional_services",
  "ecommerce",
]);

export async function POST(req: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const profileType = (body as { profileType?: unknown }).profileType;
  if (profileType !== "smb" && profileType !== "investor") {
    return NextResponse.json({ error: "profileType required" }, { status: 400 });
  }
  if (user.type !== profileType) {
    return NextResponse.json(
      { error: `wrong role for this profile (user is ${user.type})` },
      { status: 403 }
    );
  }

  const profile = getOnboardingProfile(user.id, profileType as OnboardingType);
  if (!profile) {
    return NextResponse.json({ error: "no profile draft" }, { status: 404 });
  }
  const data = safeJson<Record<string, unknown>>(profile.data_json, {});
  const enrichment = profile.enrichment_json
    ? safeJson<Record<string, unknown>>(profile.enrichment_json, {})
    : null;

  if (profileType === "smb") {
    return finalizeSmb(user.id, data, enrichment);
  }
  return finalizeInvestor(user.id, data);
}

/**
 * Creates the companies row only — financing campaigns are created
 * independently from /company/[id]/new-campaign so that an SMB can
 * later submit several campaigns without re-doing their profile.
 */
function finalizeSmb(
  userId: string,
  data: Record<string, unknown>,
  enrichment: Record<string, unknown> | null
) {
  const legalName = stringOrNull(data.legal_name);
  if (!legalName) {
    return NextResponse.json(
      { error: "missing required field", field: "legal_name" },
      { status: 400 }
    );
  }
  const country = mapCountry(data.country);
  const sectorRaw = stringOrNull(data.sector);
  const sector = sectorRaw && ALLOWED_SECTORS.has(sectorRaw) ? sectorRaw : null;
  const teamSize = numberOrNull(data.team_size_bucket);
  const monthlyRevenue = numberOrNull(data.monthly_revenue_bucket);
  const ageMedian = numberOrNull(data.age_bucket);
  const enrichmentFoundedYear = numberOrNull(
    (enrichment as { founded_year?: unknown } | null)?.founded_year
  );
  const foundedYear =
    enrichmentFoundedYear ??
    (ageMedian != null ? new Date().getFullYear() - ageMedian : null);

  const stage = inferStage(monthlyRevenue);
  const pitch = stringOrNull(data.activity_description) ?? legalName;
  const website = stringOrNull(data.website);
  const city = stringOrNull(data.city);

  const company = createCompany({
    user_id: userId,
    name: legalName,
    sector,
    stage,
    country,
    city,
    founded_year: foundedYear,
    team_size: teamSize,
    monthly_revenue_eur: monthlyRevenue,
    monthly_burn_eur: null,
    pitch,
    website,
  });

  markOnboardingSubmitted(userId, "smb");

  return NextResponse.json({
    ok: true,
    companyId: company.id,
  });
}

function finalizeInvestor(userId: string, data: Record<string, unknown>) {
  const displayName =
    stringOrNull(data.display_name) ??
    stringOrNull(data.investor_type) ??
    "Investor";

  getOrCreateInvestor(userId, displayName);

  const sectors = stringArrayOrNull(data.sectors_preferred);
  const countries = stringArrayOrNull(data.countries_preferred);
  const ticketMin = numberOrNull(data.ticket_min_eur);
  const ticketMax = numberOrNull(data.ticket_max_eur);
  const totalCapital = numberOrNull(data.total_capital_bucket);
  const risk = mapRisk(data.risk_tolerance);
  const thesisText = stringOrNull(data.thesis_raw);

  updateInvestorThesis(userId, {
    thesis_text: thesisText,
    sectors_json: sectors ? JSON.stringify(sectors) : null,
    countries_json: countries ? JSON.stringify(countries) : null,
    stages_json: null,
    ticket_min_eur: ticketMin,
    ticket_max_eur: ticketMax,
    total_capital_eur: totalCapital,
    risk_tolerance: risk,
  });

  markOnboardingSubmitted(userId, "investor");

  const after = getInvestorByUserId(userId);
  return NextResponse.json({ ok: true, investorId: after?.id ?? null });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

function stringArrayOrNull(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const xs = v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return xs.length ? xs : null;
}

function mapCountry(v: unknown): string | null {
  const s = stringOrNull(v);
  if (!s) return null;
  if (s === "OTHER") return null;
  return s.length === 2 ? s : s.slice(0, 2).toUpperCase();
}

function mapRisk(v: unknown): "low" | "medium" | "high" | null {
  if (v === "low" || v === "medium" || v === "high") return v;
  return null;
}

function inferStage(monthlyRevenueEur: number | null): string {
  if (monthlyRevenueEur == null || monthlyRevenueEur < 10_000) return "pre_revenue";
  if (monthlyRevenueEur <= 250_000) return "early";
  return "growth";
}
