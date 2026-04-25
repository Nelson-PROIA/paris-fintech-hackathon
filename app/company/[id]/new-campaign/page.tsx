import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCompanyById } from "@/lib/db";
import { NewCampaignClient } from "./NewCampaignClient";

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
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/company/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to {company.name}
      </Link>
      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          New campaign
        </h1>
        <p className="mt-1 text-muted-foreground">
          Add another fundraising campaign for {company.name}.
        </p>
      </header>
      <NewCampaignClient companyId={id} />
    </main>
  );
}
