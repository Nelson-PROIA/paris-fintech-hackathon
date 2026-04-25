import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  getCampaignWithCompany,
  listCollateralsByCampaign,
} from "@/lib/db";
import { ManageCollateralClient } from "./ManageCollateralClient";

export default async function CampaignManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("smb");
  const { id } = await params;
  const camp = getCampaignWithCompany(id);
  if (!camp) notFound();
  if (camp.company.user_id !== user.id) redirect(`/campaign/${id}`);

  const collaterals = listCollateralsByCampaign(id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/campaign/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to campaign
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Manage collateral
        </h1>
        <p className="mt-1 text-muted-foreground">
          {camp.company.name} — {camp.title}
        </p>
      </header>

      <ManageCollateralClient campaignId={id} initialCollaterals={collaterals} />
    </main>
  );
}
