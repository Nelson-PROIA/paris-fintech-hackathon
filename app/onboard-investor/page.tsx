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
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Onboarding
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.025em]">
            Investor onboarding
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            A few presets, two free-text fields and a thesis: the AI
            rephrases, you confirm. Everything stays editable.
          </p>
        </header>

        <div className="max-w-3xl">
          <InvestorOnboardingFlow
            initialData={initialData}
            initialDocuments={initialDocuments}
            initialEnrichment={initialEnrichment}
            initialEnrichmentStatus={profile.enrichment_status as EnrichmentStatus}
          />
        </div>
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
