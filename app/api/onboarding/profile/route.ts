import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  ensureOnboardingProfile,
  getOnboardingProfile,
  mergeOnboardingData,
  setEnrichmentResult,
  setEnrichmentStatus,
  type OnboardingType,
} from "@/lib/db";
import { getDefaultEnricher } from "@/lib/onboarding/enricher";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_TYPES: OnboardingType[] = ["smb", "investor"];

function parseProfileType(value: unknown): OnboardingType | null {
  if (typeof value !== "string") return null;
  return ALLOWED_TYPES.includes(value as OnboardingType)
    ? (value as OnboardingType)
    : null;
}

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const profileType = parseProfileType(url.searchParams.get("profileType"));
  if (!profileType) {
    return NextResponse.json({ error: "profileType required" }, { status: 400 });
  }

  const row = ensureOnboardingProfile(user.id, profileType);
  return NextResponse.json({
    id: row.id,
    type: row.type,
    status: row.status,
    data: safeJson(row.data_json, {}),
    documents: safeJson(row.documents_json, []),
    enrichment_json: row.enrichment_json
      ? safeJson(row.enrichment_json, null)
      : null,
    enrichment_status: row.enrichment_status,
    updated_at: row.updated_at,
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const profileType = parseProfileType(
    (body as { profileType?: unknown }).profileType
  );
  if (!profileType) {
    return NextResponse.json({ error: "profileType required" }, { status: 400 });
  }
  const patch = (body as { patch?: unknown }).patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return NextResponse.json({ error: "patch must be an object" }, { status: 400 });
  }

  const before = getOnboardingProfile(user.id, profileType);
  const previousData = before
    ? safeJson<Record<string, unknown>>(before.data_json, {})
    : {};
  const after = mergeOnboardingData(
    user.id,
    profileType,
    patch as Record<string, unknown>
  );
  const merged = safeJson<Record<string, unknown>>(after.data_json, {});

  // Trigger background enrichment for SMB the first time we have a legal name
  // and a country, while no enrichment is in flight or done.
  if (
    profileType === "smb" &&
    after.enrichment_status === "idle" &&
    typeof merged.legal_name === "string" &&
    merged.legal_name.trim().length >= 2 &&
    typeof merged.country === "string"
  ) {
    const justGotName =
      typeof previousData.legal_name !== "string" ||
      previousData.legal_name !== merged.legal_name;
    const justGotCountry = previousData.country !== merged.country;
    const justGotSiret =
      typeof patch === "object" &&
      patch !== null &&
      "siret" in (patch as Record<string, unknown>);

    if (justGotName || justGotCountry || justGotSiret) {
      setEnrichmentStatus(user.id, profileType, "running");
      const input = {
        legalName: String(merged.legal_name),
        country: typeof merged.country === "string" ? merged.country : null,
        city: typeof merged.city === "string" ? merged.city : null,
        siret: typeof merged.siret === "string" ? merged.siret : null,
      };
      // fire-and-forget
      void getDefaultEnricher()
        .enrich(input)
        .then((result) => {
          setEnrichmentResult(user.id, profileType, result, "done");
        })
        .catch((err) => {
          setEnrichmentResult(
            user.id,
            profileType,
            { error: err instanceof Error ? err.message : String(err) },
            "error"
          );
        });
    }
  }

  return NextResponse.json({ ok: true });
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
