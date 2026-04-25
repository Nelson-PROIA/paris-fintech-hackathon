import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  upsertUser,
  getUserByClerkId,
  getInvestorByUserId,
  getOnboardingProfile,
  listCompaniesByUserId,
  type UserRow,
  type UserType,
} from "@/lib/db";

type ClerkPublicMetadata = { type?: UserType };

export async function getRoleFromClerk(
  userId: string
): Promise<{ role: UserType | null; email: string; displayName: string | null }> {
  const client = await clerkClient();
  const u = await client.users.getUser(userId);
  const role = (u.publicMetadata as ClerkPublicMetadata).type ?? null;
  const email = u.primaryEmailAddress?.emailAddress ?? "";
  const displayName = u.fullName || u.username || null;
  return { role, email, displayName };
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const cached = getUserByClerkId(userId);
  if (cached) return cached;

  const { role, email, displayName } = await getRoleFromClerk(userId);
  if (!role) return null;
  return upsertUser({ id: userId, email, type: role, displayName });
}

export async function requireUser(): Promise<UserRow> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getCurrentUser();
  if (!user) redirect("/select-role");
  return user;
}

export async function requireRole(type: UserType): Promise<UserRow> {
  const user = await requireUser();
  if (user.type !== type) {
    redirect(type === "smb" ? "/feed" : "/dashboard");
  }
  return user;
}

/**
 * True if the investor has either submitted the onboarding form OR has a
 * pre-existing investor row (legacy seed). Used by the investor layout to
 * decide whether to force the new user through /onboard-investor.
 */
export function hasInvestorOnboarded(userId: string): boolean {
  const investor = getInvestorByUserId(userId);
  if (investor && investor.thesis_text) return true;
  const profile = getOnboardingProfile(userId, "investor");
  return profile?.status === "submitted";
}

/**
 * True if the SMB user has at least one company in the legacy schema OR a
 * submitted onboarding profile. Used by /dashboard or home routing.
 */
export function hasSmbOnboarded(userId: string): boolean {
  const companies = listCompaniesByUserId(userId);
  if (companies.length > 0) return true;
  const profile = getOnboardingProfile(userId, "smb");
  return profile?.status === "submitted";
}

export async function setUserRole(type: UserType): Promise<UserRow> {
  const { userId } = await auth();
  if (!userId) throw new Error("not authenticated");

  const client = await clerkClient();
  const u = await client.users.getUser(userId);
  await client.users.updateUser(userId, {
    publicMetadata: { ...(u.publicMetadata ?? {}), type },
  });

  const email = u.primaryEmailAddress?.emailAddress ?? "";
  const displayName = u.fullName || u.username || null;
  return upsertUser({ id: userId, email, type, displayName });
}
