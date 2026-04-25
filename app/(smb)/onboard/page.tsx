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

export default async function OnboardPage() {
  const user = await requireRole("smb");

  // Onboarding is a one-shot company-setup flow. If the SMB already has a
  // company on file, send them to the company page where they can edit
  // details or start a new financing campaign.
  const existingCompanies = listCompaniesByUserId(user.id);
  if (existingCompanies.length > 0) {
    redirect(`/company/${existingCompanies[0].id}`);
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
