import { requireRole } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";

export default async function SMBLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("smb");
  return (
    <>
      <TopNav role="smb" />
      {children}
    </>
  );
}
