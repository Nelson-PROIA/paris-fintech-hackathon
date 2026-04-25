import { requireRole } from "@/lib/auth";
import { OnboardChat } from "./OnboardChat";

export default async function OnboardPage() {
  await requireRole("smb");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Onboard a company
        </h1>
        <p className="mt-1 text-muted-foreground">
          Chat with our AI associate. We&apos;ll create your company plus an
          initial fundraising campaign — you can add more campaigns later.
        </p>
      </header>
      <OnboardChat />
    </main>
  );
}
