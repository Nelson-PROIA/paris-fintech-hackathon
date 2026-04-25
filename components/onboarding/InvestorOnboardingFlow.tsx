"use client";

import { OnboardingFlow } from "./OnboardingFlow";
import { INVESTOR_STEPS } from "@/lib/onboarding/investor-steps";
import type { UploadedDocument } from "./DocumentDropZone";
import type {
  EnrichmentResult,
  EnrichmentStatus,
  ProfileData,
} from "@/lib/onboarding/types";

type Props = {
  initialData: ProfileData;
  initialDocuments: UploadedDocument[];
  initialEnrichment: EnrichmentResult | null;
  initialEnrichmentStatus: EnrichmentStatus;
};

export function InvestorOnboardingFlow({
  initialData,
  initialDocuments,
  initialEnrichment,
  initialEnrichmentStatus,
}: Props) {
  return (
    <OnboardingFlow
      steps={INVESTOR_STEPS}
      initialData={initialData}
      initialDocuments={initialDocuments}
      mode={{
        kind: "profile",
        profileType: "investor",
        initialEnrichment,
        initialEnrichmentStatus,
      }}
    />
  );
}
