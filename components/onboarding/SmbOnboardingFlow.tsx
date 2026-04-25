"use client";

import { OnboardingFlow } from "./OnboardingFlow";
import { SMB_STEPS } from "@/lib/onboarding/smb-steps";
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

export function SmbOnboardingFlow({
  initialData,
  initialDocuments,
  initialEnrichment,
  initialEnrichmentStatus,
}: Props) {
  return (
    <OnboardingFlow
      steps={SMB_STEPS}
      initialData={initialData}
      initialDocuments={initialDocuments}
      mode={{
        kind: "profile",
        profileType: "smb",
        initialEnrichment,
        initialEnrichmentStatus,
      }}
    />
  );
}
