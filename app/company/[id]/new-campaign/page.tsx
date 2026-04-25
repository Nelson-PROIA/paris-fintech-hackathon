import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCompanyById } from "@/lib/db";
import { CampaignNeedFlow } from "@/components/onboarding/CampaignNeedFlow";

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("smb");
  const { id } = await params;
  const company = getCompanyById(id);
  if (!company) notFound();
  if (company.user_id !== user.id) redirect(`/company/${id}`);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/company/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour à {company.name}
      </Link>
      <header className="mt-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Nouvelle demande de financement
        </h1>
        <p className="text-muted-foreground">
          Quelques questions sur le besoin uniquement — ton profil entreprise
          ({company.name}) est déjà partagé avec les prêteurs.
        </p>
      </header>

      <div className="mt-8">
        <CampaignNeedFlow companyId={id} />
      </div>
    </main>
  );
}
