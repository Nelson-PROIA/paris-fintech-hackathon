import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  ensureOnboardingProfile,
  listCompaniesByUserId,
  type OnboardingDocument,
} from "@/lib/db";
import { SmbOnboardingFlow } from "@/components/onboarding/SmbOnboardingFlow";
import type {
  EnrichmentResult,
  EnrichmentStatus,
  ProfileData,
} from "@/lib/onboarding/types";

export default async function OnboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ force?: string }>;
}) {
  const user = await requireRole("smb");

  // Multi-company is allowed — only auto-redirect to the existing company
  // when this is the user's first visit AND they haven't asked to add another.
  // The "+ Add a company" button on /dashboard already routes here without
  // any flag; if that becomes too aggressive, append ?force=1 from the link.
  const params = (await searchParams) ?? {};
  const existingCompanies = listCompaniesByUserId(user.id);
  if (existingCompanies.length > 0 && params.force !== "1") {
    // Heuristic: if there's a draft profile in progress, let them continue.
    // If not, only block when explicitly entering "/onboard" without intent.
    // For now: allow multi-company. Don't redirect.
  }

  const profile = ensureOnboardingProfile(user.id, "smb");

  const initialData = parseJson<ProfileData>(profile.data_json, {});
  const initialDocuments = parseJson<OnboardingDocument[]>(
    profile.documents_json,
    []
  );
  const initialEnrichment = profile.enrichment_json
    ? parseJson<EnrichmentResult | null>(profile.enrichment_json, null)
    : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Company onboarding
        </h1>
        <p className="text-muted-foreground">
          Presets over open questions: tap, drag and drop, and the AI helps
          you phrase things when it matters. Everything is editable later.
        </p>
      </header>

      <SmbOnboardingFlow
        initialData={initialData}
        initialDocuments={initialDocuments}
        initialEnrichment={initialEnrichment}
        initialEnrichmentStatus={profile.enrichment_status as EnrichmentStatus}
      />
    </main>
  );
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
