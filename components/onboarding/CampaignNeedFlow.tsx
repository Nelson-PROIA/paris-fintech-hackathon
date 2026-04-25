"use client";

import { OnboardingFlow } from "./OnboardingFlow";
import { CAMPAIGN_NEED_STEPS } from "@/lib/onboarding/campaign-need-steps";
import type { UploadedDocument } from "./DocumentDropZone";
import type { ProfileData } from "@/lib/onboarding/types";

type Props = {
  companyId: string;
};

/**
 * Stepper-driven new-campaign form. Reuses the same engine as /onboard but
 * with a smaller step config focused on the financing need only.
 *
 * On submit, posts to /api/campaigns/create which inserts a `campaigns` row
 * with `meta_json` carrying the need data (need types, urgency, duration,
 * description, optional doc ids).
 */
export function CampaignNeedFlow({ companyId }: Props) {
  return (
    <OnboardingFlow
      steps={CAMPAIGN_NEED_STEPS}
      initialData={{}}
      initialDocuments={[]}
      mode={{
        kind: "campaign",
        profileType: "smb",
        submitLabels: { submitButton: "Create campaign" },
        async onSubmit(data: ProfileData, documents: UploadedDocument[]) {
          const res = await fetch("/api/campaigns/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId,
              data,
              documentIds: documents.map((d) => d.id),
            }),
          });
          const body = (await safeJson(res)) as
            | { campaignId?: string; error?: string }
            | null;
          if (!res.ok || !body?.campaignId) {
            throw new Error(
              body?.error || `Creation failed (HTTP ${res.status})`
            );
          }
          return { redirect: `/campaign/${body.campaignId}` };
        },
      }}
    />
  );
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
