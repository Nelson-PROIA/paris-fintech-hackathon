import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getRoleFromClerk,
  hasInvestorOnboarded,
  hasSmbOnboarded,
} from "@/lib/auth";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    const { role } = await getRoleFromClerk(userId);
    if (role === "smb") {
      redirect(hasSmbOnboarded(userId) ? "/dashboard" : "/onboard");
    }
    if (role === "investor") {
      redirect(
        hasInvestorOnboarded(userId) ? "/feed" : "/onboard-investor"
      );
    }
    redirect("/select-role");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16">
      <header className="space-y-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          SMB ↔ Investor Marketplace
        </h1>
        <p className="text-lg text-muted-foreground">
          AI-powered matching between European non-tech SMBs and investors.
        </p>
      </header>

      <section className="flex flex-wrap items-center justify-center gap-4">
        <SignInButton mode="modal">
          <button className="rounded-md border border-border px-5 py-2 text-sm font-medium hover:bg-accent">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Get started
          </button>
        </SignUpButton>
      </section>

      <footer className="pt-8 text-xs text-muted-foreground">
        Paris Fintech Hackathon
      </footer>
    </main>
  );
}
