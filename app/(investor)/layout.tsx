import { redirect } from "next/navigation";
import { hasInvestorOnboarded, requireRole } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";

export default async function InvestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("investor");
  if (!hasInvestorOnboarded(user.id)) {
    redirect("/onboard-investor");
  }
  return (
    <>
      <TopNav role="investor" />
      {children}
    </>
  );
}
