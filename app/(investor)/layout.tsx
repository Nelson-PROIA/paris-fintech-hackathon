import { requireRole } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";

export default async function InvestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("investor");
  return (
    <>
      <TopNav role="investor" />
      {children}
    </>
  );
}
