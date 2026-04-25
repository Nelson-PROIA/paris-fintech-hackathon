import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  upsertUser,
  getUserByClerkId,
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
