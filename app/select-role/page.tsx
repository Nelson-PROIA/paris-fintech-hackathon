import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getRoleFromClerk } from "@/lib/auth";
import { SelectRoleClient } from "./SelectRoleClient";

export default async function SelectRolePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { role } = await getRoleFromClerk(userId);
  if (role === "smb") redirect("/dashboard");
  if (role === "investor") redirect("/feed");

  return <SelectRoleClient />;
}
