import { requireRole } from "@/lib/auth";
import {
  ensureOnboardingProfile,
  type OnboardingDocument,
} from "@/lib/db";
import { InvestorOnboardingFlow } from "@/components/onboarding/InvestorOnboardingFlow";
import type {
  EnrichmentResult,
  EnrichmentStatus,
  ProfileData,
} from "@/lib/onboarding/types";
import { TopNav } from "@/components/TopNav";

export default async function OnboardInvestorPage() {
  const user = await requireRole("investor");
  const profile = ensureOnboardingProfile(user.id, "investor");

  const initialData = parseJson<ProfileData>(profile.data_json, {});
  const initialDocuments = parseJson<OnboardingDocument[]>(
    profile.documents_json,
    []
  );
  const initialEnrichment = profile.enrichment_json
    ? parseJson<EnrichmentResult | null>(profile.enrichment_json, null)
    : null;

  return (
    <>
      <TopNav role="investor" />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Onboarding investisseur
          </h1>
          <p className="text-muted-foreground">
            Quelques presets, deux zones de texte libre et une thèse :
            l'IA reformule, tu valides. Tout reste modifiable.
          </p>
        </header>

        <InvestorOnboardingFlow
          initialData={initialData}
          initialDocuments={initialDocuments}
          initialEnrichment={initialEnrichment}
          initialEnrichmentStatus={profile.enrichment_status as EnrichmentStatus}
        />
      </main>
    </>
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
